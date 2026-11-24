import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/dashboard').then(setD).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="alert">{error}</div>;
  if (!d) return <p className="muted">Loading…</p>;

  return (
    <>
      <h1>Dashboard</h1>
      <div className="stats">
        <div className="stat"><div className="stat-num">{d.total_products}</div><div className="stat-label">Products</div></div>
        <div className="stat"><div className="stat-num">{d.total_quantity}</div><div className="stat-label">Units on hand</div></div>
        <div className={'stat' + (d.low_stock.length ? ' warn' : '')}>
          <div className="stat-num">{d.low_stock.length}</div><div className="stat-label">Low stock items</div>
        </div>
      </div>

      <h2>Low stock items</h2>
      {d.low_stock.length === 0 ? (
        <div className="empty">
          {d.total_products === 0
            ? <>No products yet. <Link to="/products/new">Add your first product</Link> to start tracking stock.</>
            : 'Nothing is running low. Items appear here when quantity reaches their low stock threshold.'}
        </div>
      ) : (
        <table>
          <thead><tr><th>Name</th><th>SKU</th><th className="num">Quantity on hand</th><th className="num">Low stock threshold</th></tr></thead>
          <tbody>
            {d.low_stock.map((p) => (
              <tr key={p.id}>
                <td><Link to={`/products/${p.id}`}>{p.name}</Link></td>
                <td>{p.sku}</td>
                <td className="num"><strong>{p.quantity_on_hand}</strong></td>
                <td className="num">{p.effective_threshold}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
