import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { LOGO_GREEN } from './logo';

const C = { header: '#182B20', headerText: '#EFE8D6', bg: '#F1F3EC', accent: '#3E6B48', brick: '#AE4632', ink: '#2A2A24', sub: '#6B675A', border: '#DCE3D6' };

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError('Incorrect email or password. Ask your administrator if you\'re not sure.');
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', padding: 20 }}>
      <div style={{ maxWidth: 360, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <img src={LOGO_GREEN} alt="Sheepfold" style={{ width: 64, height: 64, objectFit: 'contain', margin: '0 auto 8px' }} />
          <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 26, color: C.ink }}>Sheepfold</div>
        </div>

        <form onSubmit={signIn} style={{ background: 'white', border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>Email</label>
          <input
            type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 10px', fontSize: 14, margin: '6px 0 12px', outline: 'none', boxSizing: 'border-box' }}
          />
          <label style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>Password</label>
          <input
            type="password" required value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 10px', fontSize: 14, margin: '6px 0 12px', outline: 'none', boxSizing: 'border-box' }}
          />
          {error && <div style={{ color: C.brick, fontSize: 12, marginBottom: 10 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ width: '100%', background: C.header, color: C.headerText, border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ fontSize: 11, color: C.sub, textAlign: 'center', marginTop: 16 }}>
          Forgotten your password? Ask your administrator to reset it for you.
        </div>
      </div>
    </div>
  );
}
