import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '', confirmPassword: '', organizationName: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setError('Enter a valid email address.');
    if (f.password.length < 8) return setError('Password must be at least 8 characters.');
    if (f.password !== f.confirmPassword) return setError('Passwords do not match.');
    if (!f.organizationName.trim()) return setError('Enter an organization name.');
    setBusy(true);
    try {
      await signup(f);
      nav('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1>Create your StockFlow account</h1>
        {error && <div className="alert" role="alert">{error}</div>}
        <label>Organization name
          <input value={f.organizationName} onChange={set('organizationName')} placeholder="My Test Store" autoFocus />
        </label>
        <label>Email
          <input type="email" value={f.email} onChange={set('email')} autoComplete="email" />
        </label>
        <label>Password
          <input type="password" value={f.password} onChange={set('password')} autoComplete="new-password" />
          <span className="hint">At least 8 characters.</span>
        </label>
        <label>Confirm password
          <input type="password" value={f.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" />
        </label>
        <button className="btn primary" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <p className="muted">Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}
