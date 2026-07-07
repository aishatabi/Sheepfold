import React, { useState } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { supabase } from './supabaseClient';

const C = { panel: '#FFFFFF', header: '#1F2E23', headerText: '#EFE8D6', bg: '#F6F4ED', gold: '#B8912E', brick: '#AE4632', sage: '#5F7A52', ink: '#2A2A24', sub: '#6B675A', border: '#E2DCC9' };

const TEMPLATE = `name,bacenta,bl,phone,missed,status
Jane Doe,Grace Bacenta,Oyin,07123456789,0,none
John Smith,Faith Bacenta,Tyrese,,3,Weak`;

// Minimal CSV parser — handles quoted fields with commas inside.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') pushField();
      else if (c === '\n') { if (field !== '' || row.length) pushRow(); }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field !== '' || row.length) pushRow();
  return rows.filter(r => r.some(f => f.trim() !== ''));
}

function rowsToMembers(rows) {
  if (rows.length === 0) return { members: [], error: 'No data found.' };
  const header = rows[0].map(h => h.trim().toLowerCase());
  const nameIdx = header.indexOf('name');
  if (nameIdx === -1) return { members: [], error: 'CSV must have a "name" column.' };
  const idx = (col) => header.indexOf(col);

  const members = rows.slice(1).map(r => {
    const get = (col) => { const i = idx(col); return i === -1 ? '' : (r[i] || '').trim(); };
    const missedRaw = get('missed');
    const status = get('status').trim() || 'none';
    return {
      name: get('name'),
      bacenta: get('bacenta') || null,
      bl: get('bl') || null,
      phone: get('phone') || null,
      missed: missedRaw ? Math.max(0, parseInt(missedRaw) || 0) : 0,
      status: ['none', 'Lost', 'Weak', 'Struggling'].includes(status) ? status : 'none',
      complex: false,
      last_visit: null,
    };
  }).filter(m => m.name);

  return { members, error: null };
}

export default function CsvImport({ onClose, onImported, isAdmin, lockedBacenta }) {
  const [raw, setRaw] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => { setRaw(evt.target.result); buildPreview(evt.target.result); };
    reader.readAsText(file);
  }

  function buildPreview(text) {
    setError(''); setDone(null);
    const rows = parseCsv(text);
    const { members, error } = rowsToMembers(rows);
    if (error) { setError(error); setPreview(null); return; }
    const scoped = isAdmin ? members : members.map(m => ({ ...m, bacenta: lockedBacenta || null }));
    setPreview(scoped);
  }

  async function runImport() {
    if (!preview || preview.length === 0) return;
    if (!isAdmin && !lockedBacenta) { setError("You haven't been assigned a bacenta yet — ask your administrator."); return; }
    setImporting(true);
    const { error } = await supabase.from('members').insert(preview);
    setImporting(false);
    if (error) { setError(error.message); return; }
    setDone(preview.length);
    onImported();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,46,35,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 60 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.panel, borderRadius: '16px 16px 0 0', padding: 18, width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 17 }}>Bulk import members</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer' }}><X size={20} /></button>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 8px' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.sage, marginBottom: 6 }}>Imported {done} member{done !== 1 ? 's' : ''}</div>
            <button onClick={onClose} style={{ ...primaryBtn, marginTop: 8 }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>
              Columns: <b>name</b> (required), bacenta, bl, phone, missed, status (none / Lost / Weak / Struggling).
              {!isAdmin && <><br />You can only add members to <b>{lockedBacenta || 'your bacenta'}</b> — any bacenta column in your file will be ignored.</>}
              Upload a CSV or paste it below.
            </div>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: `1px dashed ${C.border}`, borderRadius: 10, padding: 14, cursor: 'pointer', color: C.sub, fontSize: 13, marginBottom: 10 }}>
              <UploadCloud size={16} /> Choose a CSV file
              <input type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: 'none' }} />
            </label>

            <textarea
              value={raw}
              onChange={e => { setRaw(e.target.value); buildPreview(e.target.value); }}
              placeholder={TEMPLATE}
              style={{ width: '100%', minHeight: 110, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, fontSize: 12, fontFamily: 'monospace', color: C.ink, background: C.bg, outline: 'none', boxSizing: 'border-box' }}
            />

            {error && <div style={{ color: C.brick, fontSize: 12, marginTop: 8 }}>{error}</div>}

            {preview && !error && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 6 }}>PREVIEW — {preview.length} member{preview.length !== 1 ? 's' : ''}</div>
                <div style={{ maxHeight: 160, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 8 }}>
                  {preview.map((m, i) => (
                    <div key={i} style={{ padding: '6px 10px', fontSize: 12, borderBottom: i < preview.length - 1 ? `1px solid ${C.border}` : 'none', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{m.name}</span>
                      <span style={{ color: C.sub }}>{[m.bacenta, m.bl].filter(Boolean).join(' · ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={onClose} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
              <button
                disabled={!preview || preview.length === 0 || importing}
                onClick={runImport}
                style={{ ...primaryBtn, flex: 1, opacity: (!preview || preview.length === 0 || importing) ? 0.5 : 1 }}
              >
                {importing ? 'Importing…' : `Import ${preview ? preview.length : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const primaryBtn = { background: C.header, color: C.headerText, border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const ghostBtn = { background: 'transparent', color: C.ink, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
