const path = require('path');
const fs = require('fs');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { seedDemo } = require('./seed');

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || '0e661420b61975713b54dfec854548b61259bafaa7edc9601629c992cb83ee82';

const app = express();
app.use(express.json());

// ---------- helpers ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const bad = (res, message, status = 400) => res.status(status).json({ error: message });

// Returns { value } or { error }. Empty/undefined/null => { value: null }.
function optionalNumber(v, label, { integer = false } = {}) {
  if (v === undefined || v === null || v === '') return { value: null };
  const n = Number(v);
  if (!Number.isFinite(n)) return { error: `${label} must be a number.` };
  if (n < 0) return { error: `${label} cannot be negative.` };
  if (integer && !Number.isInteger(n)) return { error: `${label} must be a whole number.` };
  return { value: n };
}

function signToken(user) {
  return jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '7d' });
}

// ---------- auth middleware: tenant context comes from the DB, never the client ----------
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return bad(res, 'Please log in.', 401);
  try {
    const { uid } = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email, organization_id FROM users WHERE id = ?').get(uid);
    if (!user) return bad(res, 'Please log in again.', 401);
    req.user = user;
    next();
  } catch {
    return bad(res, 'Your session expired. Please log in again.', 401);
  }
}

const sessionPayload = (userId) =>
  db
    .prepare(
      `SELECT u.id, u.email, o.id AS organization_id, o.name AS organization_name,
              o.default_low_stock_threshold
       FROM users u JOIN organizations o ON o.id = u.organization_id WHERE u.id = ?`
    )
    .get(userId);

// ---------- FR-1 / FR-2: signup, login ----------
app.post('/api/auth/signup', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const confirm = req.body.confirmPassword;
  const orgName = String(req.body.organizationName || '').trim();

  if (!EMAIL_RE.test(email)) return bad(res, 'Enter a valid email address.');
  if (password.length < 8) return bad(res, 'Password must be at least 8 characters.');
  if (confirm !== undefined && confirm !== password) return bad(res, 'Passwords do not match.');
  if (!orgName) return bad(res, 'Enter an organization name.');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return bad(res, 'An account with this email already exists.', 409);
  }

  const hash = bcrypt.hashSync(password, 10);
  const create = db.transaction(() => {
    const org = db.prepare('INSERT INTO organizations (name) VALUES (?)').run(orgName);
    const user = db
      .prepare('INSERT INTO users (email, password_hash, organization_id) VALUES (?, ?, ?)')
      .run(email, hash, org.lastInsertRowid);
    return user.lastInsertRowid;
  });
  const userId = create();
  res.status(201).json({ token: signToken({ id: userId }), user: sessionPayload(userId) });
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) return bad(res, 'Enter your email and password.');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return bad(res, 'Email or password is incorrect.', 401);
  }
  res.json({ token: signToken(user), user: sessionPayload(user.id) });
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: sessionPayload(req.user.id) }));

// ---------- products ----------
const PRODUCT_SELECT = `
  SELECT p.*,
         COALESCE(p.low_stock_threshold, o.default_low_stock_threshold) AS effective_threshold,
         (p.quantity_on_hand <= COALESCE(p.low_stock_threshold, o.default_low_stock_threshold)) AS is_low_stock
  FROM products p JOIN organizations o ON o.id = p.organization_id
  WHERE p.organization_id = ?`;

const withFlag = (p) => (p ? { ...p, is_low_stock: !!p.is_low_stock } : p);

function parseProduct(body) {
  const name = String(body.name || '').trim();
  const sku = String(body.sku || '').trim();
  if (!name) return { error: 'Name is required.' };
  if (!sku) return { error: 'SKU is required.' };

  const qtyRaw = body.quantity_on_hand === '' || body.quantity_on_hand == null ? 0 : body.quantity_on_hand;
  const qty = optionalNumber(qtyRaw, 'Quantity on hand', { integer: true });
  if (qty.error) return { error: qty.error };
  const cost = optionalNumber(body.cost_price, 'Cost price');
  if (cost.error) return { error: cost.error };
  const sell = optionalNumber(body.selling_price, 'Selling price');
  if (sell.error) return { error: sell.error };
  const thr = optionalNumber(body.low_stock_threshold, 'Low stock threshold', { integer: true });
  if (thr.error) return { error: thr.error };

  const description = String(body.description || '').trim() || null;
  return {
    value: {
      name, sku, description,
      quantity_on_hand: qty.value,
      cost_price: cost.value,
      selling_price: sell.value,
      low_stock_threshold: thr.value,
    },
  };
}

const isUniqueError = (e) => e && /UNIQUE constraint failed/i.test(String(e.message));
const DUP_SKU = 'This SKU is already used by another product in your organization.';

app.get('/api/products', requireAuth, (req, res) => {
  const q = String(req.query.q || '').trim();
  let sql = PRODUCT_SELECT;
  const params = [req.user.organization_id];
  if (q) {
    sql += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY p.name COLLATE NOCASE';
  res.json({ products: db.prepare(sql).all(...params).map(withFlag) });
});

app.get('/api/products/:id', requireAuth, (req, res) => {
  const p = db.prepare(PRODUCT_SELECT + ' AND p.id = ?').get(req.user.organization_id, req.params.id);
  if (!p) return bad(res, 'Product not found.', 404);
  res.json({ product: withFlag(p) });
});

app.post('/api/products', requireAuth, (req, res) => {
  const { value, error } = parseProduct(req.body);
  if (error) return bad(res, error);
  try {
    const r = db
      .prepare(
        `INSERT INTO products (organization_id, name, sku, description, quantity_on_hand,
           cost_price, selling_price, low_stock_threshold, last_updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(req.user.organization_id, value.name, value.sku, value.description, value.quantity_on_hand,
        value.cost_price, value.selling_price, value.low_stock_threshold, req.user.email);
    const p = db.prepare(PRODUCT_SELECT + ' AND p.id = ?').get(req.user.organization_id, r.lastInsertRowid);
    res.status(201).json({ product: withFlag(p) });
  } catch (e) {
    if (isUniqueError(e)) return bad(res, DUP_SKU, 409);
    throw e;
  }
});

app.put('/api/products/:id', requireAuth, (req, res) => {
  const existing = db
    .prepare('SELECT id FROM products WHERE id = ? AND organization_id = ?')
    .get(req.params.id, req.user.organization_id);
  if (!existing) return bad(res, 'Product not found.', 404);
  const { value, error } = parseProduct(req.body);
  if (error) return bad(res, error);
  try {
    db.prepare(
      `UPDATE products SET name = ?, sku = ?, description = ?, quantity_on_hand = ?, cost_price = ?,
         selling_price = ?, low_stock_threshold = ?, last_updated_by = ?, updated_at = datetime('now')
       WHERE id = ? AND organization_id = ?`
    ).run(value.name, value.sku, value.description, value.quantity_on_hand, value.cost_price,
      value.selling_price, value.low_stock_threshold, req.user.email, req.params.id, req.user.organization_id);
    const p = db.prepare(PRODUCT_SELECT + ' AND p.id = ?').get(req.user.organization_id, req.params.id);
    res.json({ product: withFlag(p) });
  } catch (e) {
    if (isUniqueError(e)) return bad(res, DUP_SKU, 409);
    throw e;
  }
});

// FR-5 (optional): "+/- N units" with a note. No history table in MVP; note is accepted but not stored.
app.post('/api/products/:id/adjust', requireAuth, (req, res) => {
  const delta = Number(req.body.delta);
  if (!Number.isInteger(delta) || delta === 0) return bad(res, 'Enter a whole number other than 0, like 5 or -3.');
  const p = db
    .prepare('SELECT id, quantity_on_hand FROM products WHERE id = ? AND organization_id = ?')
    .get(req.params.id, req.user.organization_id);
  if (!p) return bad(res, 'Product not found.', 404);
  if (p.quantity_on_hand + delta < 0) {
    return bad(res, `Only ${p.quantity_on_hand} in stock. You can't remove ${Math.abs(delta)}.`);
  }
  db.prepare(
    `UPDATE products SET quantity_on_hand = quantity_on_hand + ?, last_updated_by = ?, updated_at = datetime('now')
     WHERE id = ? AND organization_id = ?`
  ).run(delta, req.user.email, p.id, req.user.organization_id);
  const updated = db.prepare(PRODUCT_SELECT + ' AND p.id = ?').get(req.user.organization_id, p.id);
  res.json({ product: withFlag(updated) });
});

// Hard delete (allowed by FR-4). The client asks for confirmation first.
app.delete('/api/products/:id', requireAuth, (req, res) => {
  const r = db
    .prepare('DELETE FROM products WHERE id = ? AND organization_id = ?')
    .run(req.params.id, req.user.organization_id);
  if (!r.changes) return bad(res, 'Product not found.', 404);
  res.json({ ok: true });
});

// ---------- FR-6: dashboard ----------
app.get('/api/dashboard', requireAuth, (req, res) => {
  const orgId = req.user.organization_id;
  const totals = db
    .prepare('SELECT COUNT(*) AS total_products, COALESCE(SUM(quantity_on_hand), 0) AS total_quantity FROM products WHERE organization_id = ?')
    .get(orgId);
  const low = db
    .prepare(PRODUCT_SELECT + ' AND p.quantity_on_hand <= COALESCE(p.low_stock_threshold, o.default_low_stock_threshold) ORDER BY p.quantity_on_hand ASC, p.name COLLATE NOCASE')
    .all(orgId)
    .map(withFlag);
  res.json({ ...totals, low_stock: low });
});

// ---------- FR-7: settings ----------
app.get('/api/settings', requireAuth, (req, res) => {
  const o = db.prepare('SELECT default_low_stock_threshold FROM organizations WHERE id = ?').get(req.user.organization_id);
  res.json({ default_low_stock_threshold: o.default_low_stock_threshold });
});

app.put('/api/settings', requireAuth, (req, res) => {
  const t = optionalNumber(req.body.default_low_stock_threshold, 'Default low stock threshold', { integer: true });
  if (t.error || t.value === null) return bad(res, t.error || 'Enter a default low stock threshold.');
  db.prepare('UPDATE organizations SET default_low_stock_threshold = ? WHERE id = ?').run(t.value, req.user.organization_id);
  res.json({ default_low_stock_threshold: t.value });
});

// ---------- serve built client ----------
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use('/api', (req, res) => bad(res, 'Not found.', 404));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

if (require.main === module) {
  seedDemo();
  app.listen(PORT, () => console.log(`StockFlow running on http://localhost:${PORT}`));
}
module.exports = app;
