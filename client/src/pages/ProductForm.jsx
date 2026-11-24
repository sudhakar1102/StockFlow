import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const blank = { name: '', sku: '', description: '', quantity_on_hand: '0', cost_price: '', selling_price: '', low_stock_threshold: '' };
const str = (v) => (v == null ? '' : String(v));

export default function ProductForm() {
  const { id } = useParams();
  const editing = !!id;
  const nav = useNavigate();
  const { user } = useAuth();
  const [f, setF] = useState(blank);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(editing);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (!editing) return;
    api(`/products/${id}`)
      .then(({ product: p }) => {
        setF({
          name: p.name, sku: p.sku, description: str(p.description), quantity_on_hand: str(p.quantity_on_hand),
          cost_price: str(p.cost_price), selling_price: str(p.selling_price), low_stock_threshold: str(p.low_stock_threshold),
        });
        setMeta(p);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, editing]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!f.name.trim()) return setError('Name is required.');
    if (!f.sku.trim()) return setError('SKU is required.');
    if (f.quantity_on_hand !== '' && (!Number.isInteger(Number(f.quantity_on_hand)) || Number(f.quantity_on_hand) < 0))
      return setError('Quantity on hand must be a whole number, 0 or more.');
    setBusy(true);
    try {
      await api(editing ? `/products/${id}` : '/products', { method: editing ? 'PUT' : 'POST', body: f });
      nav('/products');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <>
      <h1>{editing ? 'Edit product' : 'Add product'}</h1>
      <form className="form" onSubmit={submit} noValidate>
        {error && <div className="alert" role="alert">{error}</div>}
        <label>Name <input value={f.name} onChange={set('name')} autoFocus /></label>
        <label>SKU <input value={f.sku} onChange={set('sku')} /><span className="hint">Must be unique in your organization.</span></label>
        <label>Description <textarea rows={3} value={f.description} onChange={set('description')} /></label>
        <div className="row">
          <label>Quantity on hand <input type="number" min="0" step="1" value={f.quantity_on_hand} onChange={set('quantity_on_hand')} /></label>
          <label>Low stock threshold
            <input type="number" min="0" step="1" value={f.low_stock_threshold} onChange={set('low_stock_threshold')} placeholder={`Default (${user.default_low_stock_threshold})`} />
            <span className="hint">Leave empty to use the default.</span>
          </label>
        </div>
        <div className="row">
          <label>Cost price <input type="number" min="0" step="0.01" value={f.cost_price} onChange={set('cost_price')} /></label>
          <label>Selling price <input type="number" min="0" step="0.01" value={f.selling_price} onChange={set('selling_price')} /></label>
        </div>
        {meta && (
          <p className="muted small">
            Last updated {meta.updated_at} UTC{meta.last_updated_by ? ` by ${meta.last_updated_by}` : ''}.
          </p>
        )}
        <div className="form-actions">
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add product'}</button>
          <Link className="btn" to="/products">Cancel</Link>
        </div>
      </form>
    </>
  );
}
