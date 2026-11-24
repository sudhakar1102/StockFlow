import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    try {
      await login(email, password);
      nav('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1>Log in to StockFlow</h1>
        {error && <div className="alert" role="alert">{error}</div>}
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="email" />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        <button className="btn primary" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        <div className="demo-box">
          <div><strong>Try the demo account</strong></div>
          <div className="small muted">demo@stockflow.com / Demo@1234</div>
          <button type="button" className="btn small-btn" onClick={() => { setEmail('demo@stockflow.com'); setPassword('Demo@1234'); setError(''); }}>Use demo login</button>
        </div>
        <p className="muted">New here? <Link to="/signup">Create an account</Link></p>
      </form>
    </div>
  );
}
