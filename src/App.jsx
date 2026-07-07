import React, { useState, useEffect, useMemo } from 'react';
import { Home, Users, ClipboardCheck, Plus, X, Phone, Search, AlertTriangle, CheckCircle2, CalendarDays, Pencil, Trash2, LogOut, CheckSquare, ArrowLeft, Shield, FileDown } from 'lucide-react';
import { supabase } from './supabaseClient';
import Login from './Login';
import CsvImport from './CsvImport';
import AttendanceTab from './AttendanceTab';
import ExportTab from './ExportTab';
import { groupByMember, effectiveMissed } from './attendance';
import { LOGO_CREAM } from './logo';

const C = {
  bg: '#F1F3EC', panel: '#FFFFFF', header: '#182B20', headerText: '#EFE8D6',
  accent: '#3E6B48', accentSoft: '#D9E5DA',
  gold: '#B8912E', goldSoft: '#EEE0BC', brick: '#AE4632', brickSoft: '#F3DAD3',
  sage: '#5F7A52', sageSoft: '#DEE7D5', amber: '#C6862B', amberSoft: '#F2E1C4',
  dusk: '#3C5372', duskSoft: '#DBE2EC', ink: '#2A2A24', sub: '#6B675A', border: '#DCE3D6',
};

const STATUS_META = {
  none: { label: 'Active', color: C.sage, soft: C.sageSoft },
  Lost: { label: 'Lost', color: C.ink, soft: '#DAD8CD' },
  Weak: { label: 'Weak', color: C.amber, soft: C.amberSoft },
  Struggling: { label: 'Struggling', color: C.dusk, soft: C.duskSoft },
};

function tier(missed) {
  if (missed > 2) return 'Critical';
  if (missed === 2) return 'Mild';
  return null;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function inRange(d, start, end) { if (!d || !start || !end) return false; return d >= start && d <= end; }
function fmt(d) { if (!d) return ''; return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }

// --- map DB rows (snake_case) <-> app state (camelCase) ---
const memberFromDb = (r) => ({ id: r.id, name: r.name, bacenta: r.bacenta, bl: r.bl, phone: r.phone, missed: r.missed || 0, status: r.status || 'none', complex: !!r.complex, lastVisit: r.last_visit });
const memberToDb = (m) => ({ name: m.name, bacenta: m.bacenta, bl: m.bl, phone: m.phone, missed: m.missed, status: m.status, complex: m.complex, last_visit: m.lastVisit || null });

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out
  const [profile, setProfile] = useState(null); // null = loading, undefined-name = needs name prompt
  const [nameDraft, setNameDraft] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.from('profiles').select('name, role, bacenta').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => setProfile(data || { name: '' }));
  }, [session]);

  if (session === undefined) return <Splash text="Loading…" />;
  if (!session) return <Login />;

  if (profile === null) return <Splash text="Loading…" />;
  if (!profile.name) {
    return (
      <NamePrompt
        value={nameDraft} onChange={setNameDraft}
        onSave={async () => {
          if (!nameDraft.trim()) return;
          await supabase.from('profiles').upsert({ id: session.user.id, name: nameDraft.trim(), email: session.user.email });
          setProfile({ ...profile, name: nameDraft.trim() });
        }}
      />
    );
  }

  return <MainApp session={session} myName={profile.name} role={profile.role || 'bl'} myBacenta={profile.bacenta || null} />;
}

function Splash({ text }) {
  return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: C.sub }}>{text}</div>;
}

function NamePrompt({ value, onChange, onSave }) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', padding: 20 }}>
      <div style={{ maxWidth: 340, width: '100%', background: 'white', border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
        <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 17, marginBottom: 8 }}>What's your name?</div>
        <div style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>This is how you'll show up as a Bacenta Leader.</div>
        <input value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, width: '100%', marginBottom: 10 }} placeholder="e.g. Oyin" />
        <button onClick={onSave} style={{ ...primaryBtn, width: '100%' }}>Continue</button>
      </div>
    </div>
  );
}

function MainApp({ session, myName, role, myBacenta }) {
  const isAdmin = role === 'admin';
  const [tab, setTab] = useState('dashboard');
  const [members, setMembers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [settings, setSettings] = useState({ weekStart: '', weekEnd: '' });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterBL, setFilterBL] = useState('all');
  const [filterBacenta, setFilterBacenta] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [logFor, setLogFor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  async function fetchAll() {
    const [{ data: m }, { data: a }, { data: s }] = await Promise.all([
      supabase.from('members').select('*').order('name'),
      supabase.from('attendance').select('*'),
      supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    setMembers((m || []).map(memberFromDb));
    setAttendance(a || []);
    setSettings({ weekStart: s?.week_start || '', weekEnd: s?.week_end || '' });
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel('sheep-seeking-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, fetchAll)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const attendanceByMember = useMemo(() => groupByMember(attendance), [attendance]);
  const membersWithMissed = useMemo(
    () => members.map(m => ({ ...m, missed: effectiveMissed(m, attendanceByMember) })),
    [members, attendanceByMember]
  );

  const bls = useMemo(() => Array.from(new Set(membersWithMissed.map(m => m.bl).filter(Boolean))).sort(), [membersWithMissed]);
  const bacentas = useMemo(() => Array.from(new Set(membersWithMissed.map(m => m.bacenta).filter(Boolean))).sort(), [membersWithMissed]);
  const filtered = useMemo(() => membersWithMissed.filter(m => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterBL !== 'all' && m.bl !== filterBL) return false;
    if (filterBacenta !== 'all' && m.bacenta !== filterBacenta) return false;
    if (filterStatus !== 'all' && (m.status || 'none') !== filterStatus) return false;
    return true;
  }), [membersWithMissed, search, filterBL, filterBacenta, filterStatus]);

  const counts = useMemo(() => {
    const c = { critical: 0, mild: 0, Lost: 0, Weak: 0, Struggling: 0, visitedInWindow: 0, total: membersWithMissed.length };
    membersWithMissed.forEach(m => {
      const t = tier(m.missed || 0);
      if (t === 'Critical') c.critical++;
      if (t === 'Mild') c.mild++;
      if (m.status && m.status !== 'none') c[m.status] = (c[m.status] || 0) + 1;
      if (inRange(m.lastVisit, settings.weekStart, settings.weekEnd)) c.visitedInWindow++;
    });
    return c;
  }, [membersWithMissed, settings]);

  async function addMember(data) {
    const bacenta = isAdmin ? data.bacenta : myBacenta;
    await supabase.from('members').insert(memberToDb({ missed: 0, status: 'none', lastVisit: null, ...data, bacenta }));
    setShowAdd(false);
    fetchAll();
  }
  async function updateMember(id, patch) {
    const current = members.find(m => m.id === id);
    const bacenta = isAdmin ? patch.bacenta : current.bacenta;
    await supabase.from('members').update(memberToDb({ ...current, ...patch, bacenta })).eq('id', id);
    fetchAll();
  }
  async function deleteMember(id) {
    await supabase.from('members').delete().eq('id', id);
    setConfirmDelete(null);
    fetchAll();
  }
  async function logVisit(memberId, entry) {
    await supabase.from('visitations').insert({ member_id: memberId, date: entry.date, type: entry.type, notes: entry.notes, logged_by: myName });
    const current = members.find(m => m.id === memberId);
    await supabase.from('members').update(memberToDb({ ...current, lastVisit: entry.date })).eq('id', memberId);
    setLogFor(null);
    fetchAll();
  }
  async function saveSettings(next) {
    setSettings(next);
    await supabase.from('app_settings').update({ week_start: next.weekStart, week_end: next.weekEnd }).eq('id', 1);
  }

  if (loading) return <Splash text="Loading flock records…" />;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Inter, sans-serif', color: C.ink, paddingBottom: 90 }}>
      <style>{`* { box-sizing: border-box; } body { margin:0; } input, select, textarea, button { font-family: 'Inter', sans-serif; } ::placeholder { color: #A9A38C; }`}</style>

      <div style={{ background: C.header, color: C.headerText, padding: '20px 18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={LOGO_CREAM} alt="Sheepfold" style={{ width: 38, height: 38, objectFit: 'contain' }} />
          <div>
            <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 24 }}>Sheepfold</div>
            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>
              Signed in as {myName}{isAdmin ? ' · Administrator' : myBacenta ? ` · ${myBacenta}` : ' · not yet assigned a bacenta'}
            </div>
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: 'none', color: C.headerText, opacity: 0.8, cursor: 'pointer' }}><LogOut size={18} /></button>
      </div>

      {!isAdmin && !myBacenta && (
        <div style={{ margin: 14, background: C.amberSoft, border: `1px solid ${C.amber}40`, borderRadius: 10, padding: 12, fontSize: 13, color: C.ink }}>
          Your administrator hasn't assigned you to a bacenta yet, so there's nothing to show. Ask them to set it in the Team screen.
        </div>
      )}

      <div style={{ padding: '14px 14px 0' }}>
        <VisitationWeekBar settings={settings} onChange={saveSettings} progress={counts.visitedInWindow} total={counts.total} />
      </div>

      {tab === 'dashboard' && <Overview members={membersWithMissed} counts={counts} />}
      {tab === 'attendance' && <AttendanceTab members={members} attendance={attendance} onSaved={fetchAll} />}
      {tab === 'members' && (
        <MembersTab
          members={filtered} allBLs={bls} allBacentas={bacentas} search={search} setSearch={setSearch}
          filterBL={filterBL} setFilterBL={setFilterBL} filterBacenta={filterBacenta} setFilterBacenta={setFilterBacenta}
          filterStatus={filterStatus} setFilterStatus={setFilterStatus} isAdmin={isAdmin}
          onAdd={() => setShowAdd(true)} onImport={() => setShowImport(true)} onEdit={setEditMember} onLog={setLogFor} onDelete={setConfirmDelete}
        />
      )}
      {tab === 'bl' && <BLTab members={membersWithMissed} settings={settings} />}
      {tab === 'export' && <ExportTab members={membersWithMissed} isAdmin={isAdmin} myBacenta={myBacenta} />}
      {tab === 'team' && isAdmin && <TeamTab />}

      <TabBar tab={tab} setTab={setTab} isAdmin={isAdmin} />

      {showAdd && <MemberForm title="Add member" onCancel={() => setShowAdd(false)} onSave={addMember} isAdmin={isAdmin} lockedBacenta={myBacenta} />}
      {showImport && <CsvImport onClose={() => setShowImport(false)} onImported={fetchAll} isAdmin={isAdmin} lockedBacenta={myBacenta} />}
      {editMember && <MemberForm title="Edit member" initial={editMember} onCancel={() => setEditMember(null)} onSave={(d) => { updateMember(editMember.id, d); setEditMember(null); }} isAdmin={isAdmin} lockedBacenta={myBacenta} />}
      {logFor && <LogVisitForm member={members.find(m => m.id === logFor)} onCancel={() => setLogFor(null)} onSave={(e) => logVisit(logFor, e)} />}
      {confirmDelete && <ConfirmModal text={`Remove ${confirmDelete.name} from the flock register? This also clears their visitation history.`} onCancel={() => setConfirmDelete(null)} onConfirm={() => deleteMember(confirmDelete.id)} />}
    </div>
  );
}

function VisitationWeekBar({ settings, onChange, progress, total }) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(settings.weekStart);
  const [end, setEnd] = useState(settings.weekEnd);
  useEffect(() => { setStart(settings.weekStart); setEnd(settings.weekEnd); }, [settings.weekStart, settings.weekEnd]);
  const active = settings.weekStart && settings.weekEnd;
  const pct = total ? Math.round((progress / total) * 100) : 0;

  if (editing) {
    return (
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 8 }}>SET THIS MONTH'S VISITATION WEEK</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} style={inputStyle} />
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={() => { onChange({ weekStart: start, weekEnd: end }); setEditing(false); }} style={primaryBtn}>Save</button>
          <button onClick={() => setEditing(false)} style={ghostBtn}>Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>VISITATION WEEK</div>
          <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 16, marginTop: 2 }}>{active ? `${fmt(settings.weekStart)} – ${fmt(settings.weekEnd)}` : 'Not set for this month'}</div>
        </div>
        <button onClick={() => setEditing(true)} style={{ ...ghostBtn, padding: '6px 10px' }}><Pencil size={13} style={{ marginRight: 4 }} />Set</button>
      </div>
      {active && (
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 8, background: C.bg, borderRadius: 6, overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: C.accent }} /></div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 5 }}>{progress} of {total} members visited this week ({pct}%)</div>
        </div>
      )}
    </div>
  );
}

function Overview({ members, counts }) {
  const [drilldown, setDrilldown] = useState(null);
  const open = (title, list) => { if (list.length) setDrilldown({ title, list }); };

  return (
    <div style={{ padding: '4px 14px 14px' }}>
      <SectionTitle>Overview</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <StatCard label="Critical (>2 missed)" value={counts.critical} color={C.brick} soft={C.brickSoft} icon={<AlertTriangle size={16} />} note="Visit this week — no delay"
          onClick={() => open('Critical', members.filter(m => tier(m.missed || 0) === 'Critical'))} />
        <StatCard label="Mild (2 missed)" value={counts.mild} color={C.gold} soft={C.goldSoft} note="Telepastor Monday or plan visit"
          onClick={() => open('Mild', members.filter(m => tier(m.missed || 0) === 'Mild'))} />
        <StatCard label="Lost" value={counts.Lost || 0} color={C.ink} soft="#DAD8CD"
          onClick={() => open('Lost', members.filter(m => m.status === 'Lost'))} />
        <StatCard label="Weak" value={counts.Weak || 0} color={C.amber} soft={C.amberSoft}
          onClick={() => open('Weak', members.filter(m => m.status === 'Weak'))} />
        <StatCard label="Struggling" value={counts.Struggling || 0} color={C.dusk} soft={C.duskSoft}
          onClick={() => open('Struggling', members.filter(m => m.status === 'Struggling'))} />
        <StatCard label="Total members" value={counts.total} color={C.sage} soft={C.sageSoft} icon={<CheckCircle2 size={16} />}
          onClick={() => open('All members', members)} />
      </div>
      <SectionTitle>The flock</SectionTitle>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
        {members.length === 0 ? <EmptyNote text="No members registered yet. Add your first member from the Members tab." /> : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {members.map(m => {
                const t = tier(m.missed || 0);
                const dotColor = t === 'Critical' ? C.brick : t === 'Mild' ? C.gold : STATUS_META[m.status || 'none'].color;
                return <button key={m.id} title={`${m.name} — ${t || STATUS_META[m.status || 'none'].label}`} onClick={() => open(m.name, [m])}
                  style={{ width: 14, height: 14, borderRadius: '50%', background: dotColor, flexShrink: 0, border: 'none', padding: 0, cursor: 'pointer' }} />;
              })}
            </div>
            <Legend members={members} onOpen={open} />
          </>
        )}
      </div>
      {counts.critical > 0 && (
        <>
          <SectionTitle>Needs urgent visitation</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.filter(m => tier(m.missed || 0) === 'Critical').map(m => (
              <div key={m.id} style={{ background: C.brickSoft, border: `1px solid ${C.brick}30`, borderRadius: 10, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: C.sub }}>{m.missed} missed · {m.bl ? `BL: ${m.bl}` : 'No BL assigned'}</div>
                </div>
                {m.complex && <span style={{ fontSize: 11, background: C.brick, color: 'white', padding: '2px 8px', borderRadius: 20 }}>with Pastor Kwaku</span>}
              </div>
            ))}
          </div>
        </>
      )}
      {drilldown && <DrilldownModal title={drilldown.title} list={drilldown.list} onClose={() => setDrilldown(null)} />}
    </div>
  );
}

function DrilldownModal({ title, list, onClose }) {
  const grouped = useMemo(() => {
    const map = {};
    list.forEach(m => { const k = m.bacenta || 'No bacenta'; (map[k] ||= []).push(m); });
    Object.values(map).forEach(g => g.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [list]);
  const bacentaNames = Object.keys(grouped).sort();

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 50, overflowY: 'auto' }}>
      <div style={{ background: C.header, color: C.headerText, padding: '18px 14px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 1 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.headerText, cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} /></button>
        <div>
          <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 18 }}>{title}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{list.length} member{list.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div style={{ padding: 14, paddingBottom: 40 }}>
        {bacentaNames.map(bacenta => (
          <div key={bacenta} style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 13, color: C.accent, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 }}>
              {bacenta} <span style={{ color: C.sub, fontWeight: 400, textTransform: 'none' }}>({grouped[bacenta].length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {grouped[bacenta].map(m => {
                const t = tier(m.missed || 0);
                const st = STATUS_META[m.status || 'none'];
                return (
                  <div key={m.id} style={{ border: `1px solid ${C.border}`, background: C.panel, borderRadius: 12, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</div>
                        <div style={{ fontSize: 12, color: C.sub, marginTop: 1 }}>{m.bl ? `BL: ${m.bl}` : 'No BL'}</div>
                        {m.phone && <div style={{ fontSize: 12, color: C.sub, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}><Phone size={11} />{m.phone}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: st.soft, color: st.color }}>{st.label}</span>
                        {t && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: t === 'Critical' ? C.brickSoft : C.goldSoft, color: t === 'Critical' ? C.brick : C.gold }}>{t}</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>Missed: <b style={{ color: C.ink }}>{m.missed || 0}</b>{m.lastVisit && ` · Last visit ${fmt(m.lastVisit)}`}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ members, onOpen }) {
  const items = [
    { c: C.brick, l: 'Critical', list: members.filter(m => tier(m.missed || 0) === 'Critical') },
    { c: C.gold, l: 'Mild', list: members.filter(m => tier(m.missed || 0) === 'Mild') },
    { c: C.ink, l: 'Lost', list: members.filter(m => m.status === 'Lost') },
    { c: C.amber, l: 'Weak', list: members.filter(m => m.status === 'Weak') },
    { c: C.dusk, l: 'Struggling', list: members.filter(m => m.status === 'Struggling') },
    { c: C.sage, l: 'Active', list: members.filter(m => (m.status || 'none') === 'none' && !tier(m.missed || 0)) },
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
      {items.map(i => (
        <button key={i.l} onClick={() => onOpen(i.l, i.list)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.sub, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: i.c }} />{i.l}
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value, color, soft, icon, note, onClick }) {
  return (
    <button onClick={onClick} style={{ background: soft, borderRadius: 12, padding: 12, border: 'none', textAlign: 'left', cursor: onClick ? 'pointer' : 'default', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color, fontSize: 12, fontWeight: 600 }}>{icon}{label}</div>
      <div style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 700, color: C.ink, marginTop: 2 }}>{value}</div>
      {note && <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{note}</div>}
    </button>
  );
}

function SectionTitle({ children }) { return <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 15, color: C.ink, margin: '10px 0 8px' }}>{children}</div>; }
function EmptyNote({ text }) { return <div style={{ color: C.sub, fontSize: 13, textAlign: 'center', padding: '18px 8px' }}>{text}</div>; }

function MembersTab({ members, allBLs, allBacentas, search, setSearch, filterBL, setFilterBL, filterBacenta, setFilterBacenta, filterStatus, setFilterStatus, onAdd, onImport, onEdit, onLog, onDelete }) {
  return (
    <div style={{ padding: '4px 14px 14px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: C.sub }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members…" style={{ ...inputStyle, width: '100%', paddingLeft: 32 }} />
        </div>
        <button onClick={onImport} style={ghostBtn}>Import</button>
        <button onClick={onAdd} style={primaryBtn}><Plus size={15} style={{ marginRight: 4 }} />Add</button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto' }}>
        <select value={filterBacenta} onChange={e => setFilterBacenta(e.target.value)} style={selectStyle}>
          <option value="all">All bacentas</option>
          {allBacentas.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={filterBL} onChange={e => setFilterBL(e.target.value)} style={selectStyle}>
          <option value="all">All BLs</option>
          {allBLs.map(bl => <option key={bl} value={bl}>{bl}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="all">All statuses</option>
          <option value="none">Active</option>
          <option value="Lost">Lost</option>
          <option value="Weak">Weak</option>
          <option value="Struggling">Struggling</option>
        </select>
      </div>
      {members.length === 0 ? <EmptyNote text="No members match. Try clearing filters or add a new member." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map(m => <MemberCard key={m.id} m={m} onEdit={onEdit} onLog={onLog} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  );
}

function MemberCard({ m, onEdit, onLog, onDelete }) {
  const t = tier(m.missed || 0);
  const st = STATUS_META[m.status || 'none'];
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 1 }}>{m.bacenta ? `${m.bacenta} · ` : ''}{m.bl ? `BL: ${m.bl}` : 'No BL'}</div>
          {m.phone && <div style={{ fontSize: 12, color: C.sub, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}><Phone size={11} />{m.phone}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: st.soft, color: st.color }}>{st.label}</span>
          {t && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: t === 'Critical' ? C.brickSoft : C.goldSoft, color: t === 'Critical' ? C.brick : C.gold }}>{t}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 12, color: C.sub }}>Missed: <b style={{ color: C.ink }}>{m.missed || 0}</b>{m.lastVisit && <span> · Last visit {fmt(m.lastVisit)}</span>}</div>
        <button onClick={() => onLog(m.id)} style={{ ...ghostBtn, padding: '5px 9px', fontSize: 12 }}><CalendarDays size={12} style={{ marginRight: 3 }} />Log visit</button>
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <button onClick={() => onEdit(m)} style={{ ...ghostBtn, padding: '5px 9px', fontSize: 12, flex: 1 }}><Pencil size={12} style={{ marginRight: 3 }} />Edit</button>
        <button onClick={() => onDelete(m)} style={{ ...ghostBtn, padding: '5px 9px', fontSize: 12, color: C.brick, borderColor: `${C.brick}40` }}><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function BLTab({ members, settings }) {
  const grouped = useMemo(() => { const map = {}; members.forEach(m => { const k = m.bl || 'Unassigned'; (map[k] ||= []).push(m); }); return map; }, [members]);
  const blNames = Object.keys(grouped).sort();
  return (
    <div style={{ padding: '4px 14px 14px' }}>
      <SectionTitle>Bacenta Leader accountability</SectionTitle>
      {blNames.length === 0 ? <EmptyNote text="No members assigned yet." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {blNames.map(bl => {
            const list = grouped[bl];
            const visited = list.filter(m => inRange(m.lastVisit, settings.weekStart, settings.weekEnd)).length;
            const critical = list.filter(m => tier(m.missed || 0) === 'Critical');
            const criticalUnvisited = critical.filter(m => !inRange(m.lastVisit, settings.weekStart, settings.weekEnd));
            const pct = list.length ? Math.round((visited / list.length) * 100) : 0;
            return (
              <div key={bl} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 15 }}>{bl}</div>
                  <div style={{ fontSize: 12, color: C.sub }}>{list.length} member{list.length !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ height: 7, background: C.bg, borderRadius: 6, overflow: 'hidden', marginTop: 8 }}><div style={{ height: '100%', width: `${pct}%`, background: C.sage }} /></div>
                <div style={{ fontSize: 12, color: C.sub, marginTop: 5 }}>{visited}/{list.length} visited this Visitation Week ({pct}%)</div>
                {criticalUnvisited.length > 0 && (
                  <div style={{ marginTop: 8, background: C.brickSoft, borderRadius: 8, padding: '6px 10px', fontSize: 12, color: C.brick, fontWeight: 600 }}>
                    {criticalUnvisited.length} critical member{criticalUnvisited.length !== 1 ? 's' : ''} still not visited: {criticalUnvisited.map(m => m.name).join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabBar({ tab, setTab, isAdmin }) {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'attendance', label: 'Attendance', icon: CheckSquare },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'bl', label: 'BLs', icon: ClipboardCheck },
    { id: 'export', label: 'Export', icon: FileDown },
    ...(isAdmin ? [{ id: 'team', label: 'Team', icon: Shield }] : []),
  ];
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.panel, borderTop: `1px solid ${C.border}`, display: 'flex', overflowX: 'auto', padding: '8px 6px calc(8px + env(safe-area-inset-bottom))' }}>
      {items.map(it => {
        const Icon = it.icon; const active = tab === it.id;
        return <button key={it.id} onClick={() => setTab(it.id)} style={{ flex: '1 0 62px', minWidth: 62, background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: active ? C.accent : C.sub, fontSize: 11, fontWeight: 600, padding: '4px 2px', cursor: 'pointer', whiteSpace: 'nowrap' }}><Icon size={19} />{it.label}</button>;
      })}
    </div>
  );
}

function TeamTab() {
  const [profiles, setProfiles] = useState([]);
  const [bacentaOptions, setBacentaOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  async function fetchAll() {
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from('profiles').select('*').order('name'),
      supabase.from('members').select('bacenta'),
    ]);
    setProfiles(p || []);
    setBacentaOptions(Array.from(new Set((m || []).map(r => r.bacenta).filter(Boolean))).sort());
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  async function saveProfile(id, patch) {
    setSavingId(id);
    await supabase.from('profiles').update(patch).eq('id', id);
    await fetchAll();
    setSavingId(null);
  }

  if (loading) return <div style={{ padding: '4px 14px 14px' }}><EmptyNote text="Loading team…" /></div>;

  return (
    <div style={{ padding: '4px 14px 14px' }}>
      <SectionTitle>Team access</SectionTitle>
      <div style={{ fontSize: 13, color: C.sub, marginBottom: 12 }}>
        Set each leader's bacenta so they only see their own members. Admins see everything.
      </div>
      <datalist id="bacenta-options">
        {bacentaOptions.map(b => <option key={b} value={b} />)}
      </datalist>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {profiles.map(p => (
          <div key={p.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name || '(no name yet)'}</div>
            {p.email && <div style={{ fontSize: 12, color: C.sub, marginTop: 1 }}>{p.email}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <select
                value={p.role || 'bl'}
                onChange={e => saveProfile(p.id, { role: e.target.value })}
                style={{ ...inputStyle, flex: 1 }}
              >
                <option value="bl">Bacenta Leader</option>
                <option value="admin">Administrator</option>
              </select>
              <input
                list="bacenta-options"
                value={p.bacenta || ''}
                onChange={e => setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, bacenta: e.target.value } : x))}
                onBlur={e => saveProfile(p.id, { bacenta: e.target.value || null })}
                placeholder={p.role === 'admin' ? 'Not needed for admins' : 'e.g. Grace Bacenta'}
                disabled={p.role === 'admin'}
                style={{ ...inputStyle, flex: 1, opacity: p.role === 'admin' ? 0.5 : 1 }}
              />
            </div>
            {savingId === p.id && <div style={{ fontSize: 11, color: C.accent, marginTop: 6 }}>Saving…</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function MemberForm({ title, initial, onCancel, onSave, isAdmin, lockedBacenta }) {
  const [name, setName] = useState(initial?.name || '');
  const [bacenta, setBacenta] = useState(initial?.bacenta || (isAdmin ? '' : (lockedBacenta || '')));
  const [bl, setBl] = useState(initial?.bl || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [missed, setMissed] = useState(initial?.missed ?? 0);
  const [status, setStatus] = useState(initial?.status || 'none');
  const [complex, setComplex] = useState(initial?.complex || false);
  return (
    <Modal onClose={onCancel} title={title}>
      <Field label="Name"><input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Full name" /></Field>
      <Field label="Bacenta (Sonta)">
        {isAdmin ? (
          <input value={bacenta} onChange={e => setBacenta(e.target.value)} style={inputStyle} placeholder="e.g. Grace Bacenta" />
        ) : (
          <div style={{ ...inputStyle, background: C.bg, color: C.sub }}>{lockedBacenta || 'Not assigned — ask your administrator'}</div>
        )}
      </Field>
      <Field label="Bacenta Leader"><input value={bl} onChange={e => setBl(e.target.value)} style={inputStyle} placeholder="BL name" /></Field>
      <Field label="Phone"><input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="Optional" /></Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label="Fallback missed count (used until attendance is recorded)" style={{ flex: 1 }}><input type="number" min="0" value={missed} onChange={e => setMissed(Math.max(0, parseInt(e.target.value) || 0))} style={inputStyle} /></Field>
        <Field label="Status" style={{ flex: 1 }}>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
            <option value="none">Active</option><option value="Lost">Lost</option><option value="Weak">Weak</option><option value="Struggling">Struggling</option>
          </select>
        </Field>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.ink, margin: '10px 0' }}>
        <input type="checkbox" checked={complex} onChange={e => setComplex(e.target.checked)} />Complex case — visit together with Pastor Kwaku
      </label>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={onCancel} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
        <button disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), bacenta: isAdmin ? bacenta : lockedBacenta, bl, phone, missed, status, complex })} style={{ ...primaryBtn, flex: 1, opacity: name.trim() ? 1 : 0.5 }}>Save</button>
      </div>
    </Modal>
  );
}

function LogVisitForm({ member, onCancel, onSave }) {
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState('Visitation');
  const [notes, setNotes] = useState('');
  if (!member) return null;
  return (
    <Modal onClose={onCancel} title={`Log visit — ${member.name}`}>
      <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} /></Field>
      <Field label="Type">
        <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
          <option>Visitation</option><option>Telepastor call</option><option>Co-visit with Pastor Kwaku</option>
        </select>
      </Field>
      <Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, width: '100%', minHeight: 70, resize: 'vertical' }} placeholder="Optional" /></Field>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={onCancel} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
        <button onClick={() => onSave({ date, type, notes })} style={{ ...primaryBtn, flex: 1 }}>Save visit</button>
      </div>
    </Modal>
  );
}

function ConfirmModal({ text, onCancel, onConfirm }) {
  return (
    <Modal onClose={onCancel} title="Are you sure?">
      <div style={{ fontSize: 13, color: C.sub, marginBottom: 14 }}>{text}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
        <button onClick={onConfirm} style={{ ...primaryBtn, flex: 1, background: C.brick }}>Remove</button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,46,35,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.panel, borderRadius: '16px 16px 0 0', padding: 18, width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 17 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer' }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, style }) {
  return <div style={{ marginBottom: 10, ...style }}><div style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 4 }}>{label}</div>{children}</div>;
}

const inputStyle = { border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 10px', fontSize: 14, color: C.ink, background: C.bg, outline: 'none' };
const selectStyle = { ...inputStyle, flexShrink: 0 };
const primaryBtn = { background: C.header, color: C.headerText, border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const ghostBtn = { background: 'transparent', color: C.ink, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
