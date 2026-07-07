import React, { useState, useMemo } from 'react';
import { FileDown } from 'lucide-react';
import { supabase } from './supabaseClient';

const C = { panel: '#FFFFFF', header: '#182B20', headerText: '#EFE8D6', bg: '#F1F3EC', accent: '#3E6B48', brick: '#AE4632', ink: '#2A2A24', sub: '#6B675A', border: '#DCE3D6' };

function tier(missed) {
  if (missed > 2) return 'Critical';
  if (missed === 2) return 'Mild';
  return 'None';
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function fmtDate(d) { if (!d) return '—'; return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }

export default function ExportTab({ members, isAdmin, myBacenta }) {
  const bacentas = useMemo(() => Array.from(new Set(members.map(m => m.bacenta).filter(Boolean))).sort(), [members]);
  const [scope, setScope] = useState(isAdmin ? 'all' : (myBacenta || ''));
  const [dateStart, setDateStart] = useState(daysAgoISO(30));
  const [dateEnd, setDateEnd] = useState(todayISO());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const scopedMembers = useMemo(() => {
    if (isAdmin && scope === 'all') return members;
    const target = isAdmin ? scope : myBacenta;
    return members.filter(m => m.bacenta === target);
  }, [members, scope, isAdmin, myBacenta]);

  async function generate() {
    setError('');
    if (scopedMembers.length === 0) { setError('No members in this scope to report on.'); return; }
    setGenerating(true);
    try {
      const memberIds = scopedMembers.map(m => m.id);

      const [{ data: visits }, { data: att }] = await Promise.all([
        supabase.from('visitations').select('*').in('member_id', memberIds).gte('date', dateStart).lte('date', dateEnd).order('date'),
        supabase.from('attendance').select('*').in('member_id', memberIds).gte('service_date', dateStart).lte('service_date', dateEnd),
      ]);

      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF();
      const scopeLabel = (isAdmin && scope === 'all') ? 'First Love Beds — All Bacentas' : (isAdmin ? scope : myBacenta);

      doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
      doc.text('Sheepfold Report', 14, 18);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
      doc.text(scopeLabel, 14, 26);
      doc.setFontSize(10); doc.setTextColor(110);
      doc.text(`${fmtDate(dateStart)} – ${fmtDate(dateEnd)}   ·   Generated ${fmtDate(todayISO())}`, 14, 32);
      doc.setTextColor(0);

      // Summary counts
      const counts = { Critical: 0, Mild: 0, Lost: 0, Weak: 0, Struggling: 0, Active: 0 };
      scopedMembers.forEach(m => {
        const t = tier(m.missed || 0);
        if (t === 'Critical') counts.Critical++;
        else if (t === 'Mild') counts.Mild++;
        else if (m.status === 'Lost') counts.Lost++;
        else if (m.status === 'Weak') counts.Weak++;
        else if (m.status === 'Struggling') counts.Struggling++;
        else counts.Active++;
      });

      autoTable(doc, {
        startY: 38,
        head: [['Total', 'Critical', 'Mild', 'Lost', 'Weak', 'Struggling', 'Active']],
        body: [[scopedMembers.length, counts.Critical, counts.Mild, counts.Lost, counts.Weak, counts.Struggling, counts.Active]],
        theme: 'grid', headStyles: { fillColor: [24, 43, 32] }, styles: { fontSize: 9, halign: 'center' },
      });

      // Member list
      let y = doc.lastAutoTable.finalY + 10;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('Members', 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [['Name', 'Bacenta', 'BL', 'Status', 'Missed', 'Last visit']],
        body: scopedMembers
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(m => [m.name, m.bacenta || '—', m.bl || '—', m.status && m.status !== 'none' ? m.status : 'Active', m.missed || 0, m.lastVisit ? fmtDate(m.lastVisit) : '—']),
        theme: 'striped', headStyles: { fillColor: [24, 43, 32] }, styles: { fontSize: 8.5 },
      });

      // Visitation log within range
      y = doc.lastAutoTable.finalY + 10;
      if (y > 260) { doc.addPage(); y = 18; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('Visitation log', 14, y);
      const nameById = Object.fromEntries(scopedMembers.map(m => [m.id, m.name]));
      const visitRows = (visits || []).map(v => [fmtDate(v.date), nameById[v.member_id] || '—', v.type || '—', v.logged_by || '—', v.notes || '']);
      autoTable(doc, {
        startY: y + 4,
        head: [['Date', 'Member', 'Type', 'Logged by', 'Notes']],
        body: visitRows.length ? visitRows : [['—', 'No visits logged in this date range', '', '', '']],
        theme: 'striped', headStyles: { fillColor: [24, 43, 32] }, styles: { fontSize: 8.5 },
      });

      // Attendance summary within range
      y = doc.lastAutoTable.finalY + 10;
      if (y > 250) { doc.addPage(); y = 18; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('Attendance by service date', 14, y);
      const byDate = {};
      (att || []).forEach(a => {
        byDate[a.service_date] ||= { present: 0, total: 0 };
        byDate[a.service_date].total++;
        if (a.present) byDate[a.service_date].present++;
      });
      const dateRows = Object.keys(byDate).sort().map(d => {
        const { present, total } = byDate[d];
        return [fmtDate(d), present, total - present, `${Math.round((present / total) * 100)}%`];
      });
      autoTable(doc, {
        startY: y + 4,
        head: [['Service date', 'Present', 'Absent', 'Attendance']],
        body: dateRows.length ? dateRows : [['—', 'No attendance recorded in this date range', '', '']],
        theme: 'striped', headStyles: { fillColor: [24, 43, 32] }, styles: { fontSize: 8.5 },
      });

      const scopeSlug = scopeLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      doc.save(`sheepfold-${scopeSlug}-${dateStart}-to-${dateEnd}.pdf`);
    } catch (e) {
      setError('Something went wrong generating the PDF. Try again.');
      console.error(e);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={{ padding: '4px 14px 14px' }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 8 }}>SCOPE</div>
        {isAdmin ? (
          <select value={scope} onChange={e => setScope(e.target.value)} style={{ ...inputStyle, width: '100%', marginBottom: 14 }}>
            <option value="all">Whole church — all bacentas</option>
            {bacentas.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        ) : (
          <div style={{ ...inputStyle, width: '100%', marginBottom: 14, background: C.bg, color: C.sub, boxSizing: 'border-box' }}>{myBacenta || 'Not assigned yet'}</div>
        )}

        <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 8 }}>DATE RANGE</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[{ l: 'Last 7 days', n: 7 }, { l: 'Last 30 days', n: 30 }, { l: 'Last 90 days', n: 90 }].map(p => (
            <button key={p.n} onClick={() => { setDateStart(daysAgoISO(p.n)); setDateEnd(todayISO()); }} style={miniBtn}>{p.l}</button>
          ))}
        </div>

        {error && <div style={{ color: C.brick, fontSize: 12, marginBottom: 10 }}>{error}</div>}

        <button onClick={generate} disabled={generating} style={{ width: '100%', background: C.header, color: C.headerText, border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: generating ? 0.6 : 1 }}>
          <FileDown size={16} />{generating ? 'Building PDF…' : 'Download PDF'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: C.sub, marginTop: 14, lineHeight: 1.5 }}>
        The report includes a summary of statuses, the full member list for the
        chosen scope, every visit logged in the date range, and attendance
        for each service date in that range.
      </div>
    </div>
  );
}

const inputStyle = { border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 10px', fontSize: 14, color: C.ink, background: C.bg, outline: 'none' };
const miniBtn = { background: 'transparent', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 20, padding: '5px 11px', fontSize: 11, fontWeight: 600, cursor: 'pointer' };
