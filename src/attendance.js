// Shared helpers for turning raw attendance rows into the "consecutive missed" count.

export function lastSunday(from = new Date()) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

export function groupByMember(attendance) {
  const map = {};
  attendance.forEach(r => { (map[r.member_id] ||= []).push(r); });
  return map;
}

// Counts the run of consecutive absences starting from the most recent
// recorded Sunday and stopping at the first "present" record.
export function computeConsecutiveAbsent(records) {
  if (!records || records.length === 0) return null; // null = no attendance data yet
  const sorted = [...records].sort((a, b) => b.service_date.localeCompare(a.service_date));
  let count = 0;
  for (const r of sorted) {
    if (r.present) break;
    count++;
  }
  return count;
}

// Uses real attendance data when available; otherwise falls back to the
// manually-entered members.missed value (e.g. for members imported before
// attendance tracking started).
export function effectiveMissed(member, attendanceByMember) {
  const computed = computeConsecutiveAbsent(attendanceByMember[member.id]);
  return computed !== null ? computed : (member.missed || 0);
}

export function hasAttendanceHistory(member, attendanceByMember) {
  return !!(attendanceByMember[member.id] && attendanceByMember[member.id].length > 0);
}
