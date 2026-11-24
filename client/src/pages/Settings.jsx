import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Settings() {
  const { setDefaultThreshold } = useAuth();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api('/settings').then((d) => setValue(String(d.default_low_stock_threshold))).catch((e) => setError(e.message));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    try {
      const d = await api('/settings', { method: 'PUT', body: { default_low_stock_threshold: value } });
      setDefaultThreshold(d.default_low_stock_threshold);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <h1>Settings</h1>
      <form className="form" onSubmit={submit} noValidate>
        {error && <div className="alert" role="alert">{error}</div>}
        {saved && <div className="success" role="status">Settings saved.</div>}
        <label>Default low stock threshold
          <input type="number" min="0" step="1" value={value} onChange={(e) => { setValue(e.target.value); setSaved(false); }} />
          <span className="hint">Used for any product that has no threshold of its own.</span>
        </label>
        <div className="form-actions"><button className="btn primary">Save changes</button></div>
      </form>
    </>
  );
}
