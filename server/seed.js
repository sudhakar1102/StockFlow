// Creates a demo account with sample products if it doesn't exist yet.
// Runs on every start, so a wiped database (e.g. on a free host) comes back with a working demo login.
const bcrypt = require('bcryptjs');
const db = require('./db');

const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@stockflow.com';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@1234';

const PRODUCTS = [
  ['Wireless Mouse', 'WM-100', 'Compact 2.4 GHz wireless mouse', 42, 8, 15, null],
  ['Mechanical Keyboard', 'KB-200', 'Blue-switch full-size keyboard', 4, 35, 59, null],
  ['USB-C Cable (1m)', 'UC-300', 'Braided fast-charge cable', 120, 2, 6, 20],
  ['Laptop Stand', 'LS-400', 'Adjustable aluminium stand', 3, 12, 25, null],
  ['HD Webcam', 'WC-500', '1080p webcam with microphone', 15, 18, 35, 10],
  ['Desk Lamp', 'DL-600', 'LED lamp with dimmer', 5, 9, 19, null],
  ['A5 Notebook', 'NB-700', 'Ruled, 200 pages', 200, 1, 3, 50],
  ['24" Monitor', 'MN-800', 'Full HD IPS display', 2, 90, 139, 3],
];

function seedDemo() {
  if (process.env.SEED_DEMO === 'false') return;
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(DEMO_EMAIL)) return;

  db.transaction(() => {
    const org = db.prepare('INSERT INTO organizations (name) VALUES (?)').run('Demo Store');
    db.prepare('INSERT INTO users (email, password_hash, organization_id) VALUES (?, ?, ?)')
      .run(DEMO_EMAIL, bcrypt.hashSync(DEMO_PASSWORD, 10), org.lastInsertRowid);
    const ins = db.prepare(
      `INSERT INTO products (organization_id, name, sku, description, quantity_on_hand, cost_price, selling_price, low_stock_threshold, last_updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const [name, sku, desc, qty, cost, sell, thr] of PRODUCTS) {
      ins.run(org.lastInsertRowid, name, sku, desc, qty, cost, sell, thr, DEMO_EMAIL);
    }
  })();
  console.log(`Demo account created: ${DEMO_EMAIL}`);
}

module.exports = { seedDemo, DEMO_EMAIL, DEMO_PASSWORD };
