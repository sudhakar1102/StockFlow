import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const money = (v) => (v == null ? '—' : Number(v).toFixed(2));

function AdjustRow({ product, onDone, onCancel }) {
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  async function apply(e) {
    e.preventDefault();
    setError('');
    try {
      await api(`/products/${product.id}/adjust`, { method: 'POST', body: { delta: Number(delta), note } });
      onDone();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <tr className="adjust-row">
      <td colSpan={6}>
        <form className="adjust" onSubmit={apply}>
          <span>Adjust <strong>{product.name}</strong> ({product.quantity_on_hand} on hand)</span>
          <input type="number" step="1" placeholder="+5 or -3" value={delta} onChange={(e) => setDelta(e.target.value)} autoFocus aria-label="Units to add or remove" />
          <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
          <button className="btn primary small-btn">Apply</button>
          <button type="button" className="btn small-btn" onClick={onCancel}>Cancel</button>
          {error && <span className="inline-error">{error}</span>}
        </form>
      </td>
    </tr>
  );
}

export default function Products() {
  const [q, setQ] = useState('');
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [adjusting, setAdjusting] = useState(null);

  const load = useCallback(() => {
    api(`/products?q=${encodeURIComponent(q.trim())}`)
      .then((d) => setProducts(d.products))
      .catch((e) => setError(e.message));
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function remove(p) {
    if (!window.confirm(`Delete "${p.name}" (${p.sku})? This can't be undone.`)) return;
    try {
      await api(`/products/${p.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Products</h1>
        <Link className="btn primary" to="/products/new">Add product</Link>
      </div>
      <input className="search" type="search" placeholder="Search by name or SKU" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
      {error && <div className="alert">{error}</div>}
      {!products ? (
        <p className="muted">Loading…</p>
      ) : products.length === 0 ? (
        <div className="empty">
          {q.trim() ? `No products match "${q.trim()}".` : <>No products yet. <Link to="/products/new">Add your first product</Link>.</>}
        </div>
      ) : (
        <table>
          <thead>
            <tr><th>Name</th><th>SKU</th><th className="num">Quantity</th><th>Stock</th><th className="num">Selling price</th><th></th></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <React.Fragment key={p.id}>
                <tr>
                  <td><Link to={`/products/${p.id}`}>{p.name}</Link></td>
                  <td>{p.sku}</td>
                  <td className="num">{p.quantity_on_hand}</td>
                  <td>{p.is_low_stock ? <span className="badge low">Low stock</span> : <span className="badge ok">In stock</span>}</td>
                  <td className="num">{money(p.selling_price)}</td>
                  <td className="actions">
                    <button className="link" onClick={() => setAdjusting(adjusting === p.id ? null : p.id)}>Adjust stock</button>
                    <Link to={`/products/${p.id}`}>Edit</Link>
                    <button className="link danger" onClick={() => remove(p)}>Delete</button>
                  </td>
                </tr>
                {adjusting === p.id && (
                  <AdjustRow product={p} onCancel={() => setAdjusting(null)} onDone={() => { setAdjusting(null); load(); }} />
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
