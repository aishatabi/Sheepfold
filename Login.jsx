import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { LOGO_GREEN } from './logo';

const C = { header: '#182B20', headerText: '#EFE8D6', bg: '#F1F3EC', accent: '#3E6B48', ink: '#2A2A24', sub: '#6B675A', border: '#DCE3D6' };

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendLink(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
    });
    setLoading(false);
    if (error) setError("We couldn't find an account for that email. Ask your administrator to add you.");
    else setSent(true);
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', padding: 20 }}>
      <div style={{ maxWidth: 360, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <img src={LOGO_GREEN} alt="Sheepfold" style={{ width: 64, height: 64, objectFit: 'contain', margin: '0 auto 8px' }} />
          <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 26, color: C.ink }}>Sheepfold</div>
          <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>First Love Beds — leader sign in</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>Access is by invitation only.</div>
        </div>

        {sent ? (
          <div style={{ background: 'white', border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, textAlign: 'center' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Check your email</div>
            <div style={{ fontSize: 13, color: C.sub }}>We sent a sign-in link to {email}. Open it on this device to continue.</div>
          </div>
        ) : (
          <form onSubmit={sendLink} style={{ background: 'white', border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>Email</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 10px', fontSize: 14, margin: '6px 0 12px', outline: 'none', boxSizing: 'border-box' }}
            />
            {error && <div style={{ color: '#AE4632', fontSize: 12, marginBottom: 10 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ width: '100%', background: C.header, color: C.headerText, border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {loading ? 'Sending…' : 'Send me a sign-in link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
