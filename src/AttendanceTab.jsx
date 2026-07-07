import React, { useState, useEffect, useMemo } from 'react';
import { Check, X as XIcon } from 'lucide-react';
import { supabase } from './supabaseClient';
import { lastSunday, groupByMember, computeConsecutiveAbsent } from './attendance';

const C = { panel: '#FFFFFF', header: '#1F2E23', headerText: '#EFE8D6', bg: '#F6F4ED', gold: '#B8912E', brick: '#AE4632', brickSoft: '#F3DAD3', sage: '#5F7A52', sageSoft: '#DEE7D5', ink: '#2A2A24', sub: '#6B675A', border: '#E2DCC9' };

export default function AttendanceTab({ members, attendance, onSaved }) {
  const [serviceDate, setServiceDate] = useState(lastSunday());
  const [present, setPresent] = useState({}); // memberId -> bool
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const takenDates = useMemo(() => {
    const set = new Set(attendance.map(a => a.service_date));
    return Array.from(set).sort().reverse().slice(0, 8);
  }, [attendance]);

  useEffect(() => {
    // Pre-fill from existing records for this date, default everyone to absent.
    const existing = {};
    attendance.filter(a => a.service_date === serviceDate).forEach(a => { existing[a.member_id] = a.present; });
    const initial = {};
    members.forEach(m => { initial[m.id] = existing.hasOwnProperty(m.id) ? existing[m.id] : false; });
    setPresent(initial);
    setSaved(false);
  }, [serviceDate, members, attendance]);

  const presentCount = Object.values(present).filter(Boolean).length;

  async function save() {
    setSaving(true);
    const rows = members.map(m => ({ member_id: m.id, service_date: serviceDate, present: !!present[m.id] }));
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'member_id,service_date' });
    setSaving(false);
    if (!error) { setSaved(true); onSaved(); }
  }

  const attendanceByMember = useMemo(() => groupByMember(attendance), [attendance]);

  return (
    <div style={{ padding: '4px 14px 14px' }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 6 }}>SERVICE DATE</div>
        <input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 10px', fontSize: 14, background: C.bg, outline: 'none' }} />
        {takenDates.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {takenDates.map(d => (
              <button key={d} onClick={() => setServiceDate(d)} style={{
                fontSize: 11, padding: '4px 9px', borderRadius: 20, border: `1px solid ${d === serviceDate ? C.gold : C.border}`,
                background: d === serviceDate ? C.gold : 'transparent', color: d === serviceDate ? 'white' : C.sub, cursor: 'pointer',
              }}>{new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 13, color: C.sub }}>{presentCount} of {members.length} marked present</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setPresent(Object.fromEntries(members.map(m => [m.id, true])))} style={miniBtn}>All present</button>
          <button onClick={() => setPresent(Object.fromEntries(members.map(m => [m.id, false])))} style={miniBtn}>All absent</button>
        </div>
      </div>

      {members.length === 0 ? (
        <div style={{ color: C.sub, fontSize: 13, textAlign: 'center', padding: '18px 8px' }}>No members yet — add some from the Members tab first.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 90 }}>
          {members.map(m => {
            const isPresent = !!present[m.id];
            const currentStreak = computeConsecutiveAbsent(attendanceByMember[m.id]);
            return (
              <div key={m.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: C.sub }}>
                    {m.bl ? `BL: ${m.bl}` : 'No BL'}{currentStreak !== null && currentStreak > 0 ? ` · ${currentStreak} missed in a row` : ''}
                  </div>
                </div>
                <button
                  onClick={() => setPresent(p => ({ ...p, [m.id]: !p[m.id] }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, border: 'none', borderRadius: 20, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    background: isPresent ? C.sageSoft : C.brickSoft, color: isPresent ? C.sage : C.brick,
                  }}
                >
                  {isPresent ? <Check size={13} /> : <XIcon size={13} />}
                  {isPresent ? 'Present' : 'Absent'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ position: 'fixed', bottom: 62, left: 0, right: 0, padding: '10px 14px', background: 'linear-gradient(transparent, ' + C.bg + ' 30%)' }}>
        <button onClick={save} disabled={saving || members.length === 0} style={{
          width: '100%', background: C.header, color: C.headerText, border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Saving…' : saved ? 'Saved ✓ — tap to update' : `Save attendance for ${new Date(serviceDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
        </button>
      </div>
    </div>
  );
}

const miniBtn = { background: 'transparent', border: `1px solid ${C.border}`, color: C.sub, borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' };
