// Run: node tests/parser.test.js
const assert = require('assert');
const SR = require('../app/parser.js');
const T = { termStart: '2026-08-31', course: 'TEST' }; // a Monday
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }
const one = (line) => SR.parseSyllabus(line, T)[0];

t('month name', () => { const i = one('Midterm Exam 1 - Oct 3'); assert.strictEqual(i.date, '2026-10-03'); assert.strictEqual(i.type, 'exam'); assert.strictEqual(i.confidence, 'high'); });
t('full month + ordinal', () => assert.strictEqual(one('Project proposal due September 18th').date, '2026-09-18'));
t('day before month', () => assert.strictEqual(one('Quiz 2: 7 Oct').date, '2026-10-07'));
t('numeric m/d', () => assert.strictEqual(one('HW 4 due 10/03').date, '2026-10-03'));
t('numeric m/d/yy', () => assert.strictEqual(one('Lab report due 11/2/26').date, '2026-11-02'));
t('ISO date', () => assert.strictEqual(one('Final exam 2026-12-14').date, '2026-12-14'));
t('year rollover for spring term', () => {
  const it = SR.parseSyllabus('Final project due Jan 5', { termStart: '2026-09-01', course: 'X' })[0];
  assert.strictEqual(it.date, '2027-01-05');
});
t('week + weekday', () => { const i = one('Week 5 Tuesday: Quiz 3'); assert.strictEqual(i.date, '2026-09-29'); assert.strictEqual(i.confidence, 'medium'); });
t('week only defaults to Friday, low confidence', () => { const i = one('Wk 3 - Problem Set 2 due'); assert.strictEqual(i.date, '2026-09-18'); assert.strictEqual(i.confidence, 'low'); });
t('week heading gives context to weekday lines', () => {
  const items = SR.parseSyllabus('Week 6\nThu: Exam 1 in class\nReading: none', T);
  assert.strictEqual(items.length, 1); assert.strictEqual(items[0].date, '2026-10-08'); assert.strictEqual(items[0].type, 'exam');
});
t('invalid date ignored', () => assert.strictEqual(SR.parseSyllabus('HW due 2/30', T).length, 0));
t('chapter numbers are not dates', () => assert.strictEqual(SR.parseSyllabus('Read chapter 3.2 and 4.1', T).length, 0));
t('holidays skipped', () => assert.strictEqual(SR.parseSyllabus('Nov 26 - Thanksgiving break, no class', T).length, 0));
t('classify', () => { assert.strictEqual(SR.classify('Problem Set 3'), 'homework'); assert.strictEqual(SR.classify('Term paper'), 'project'); assert.strictEqual(SR.classify('Read Ch. 4'), 'reading'); });
t('workload crunch week', () => {
  const items = [...SR.parseSyllabus('Midterm Oct 14', { ...T, course: 'A' }), ...SR.parseSyllabus('Project 2 due Oct 16', { ...T, course: 'B' })];
  const w = SR.workload(items, T.termStart); const wk = w.weeks[SR.weekIndex('2026-10-14', T.termStart) - 1];
  assert.strictEqual(wk.total, 9); assert.ok(wk.crunch);
});
t('suggested start', () => assert.strictEqual(SR.suggestStart({ type: 'project', date: '2026-10-16' }), '2026-10-02'));
t('ics is valid-ish RFC 5545', () => {
  const ics = SR.toIcs([{ course: 'CS 1', title: 'Project, part; one ' + 'x'.repeat(100), type: 'project', date: '2026-10-16', source: 's' }], { startReminders: true, now: new Date('2026-10-01T00:00:00Z') });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n')); assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.strictEqual((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261016')); assert.ok(ics.includes('DTEND;VALUE=DATE:20261017'));
  assert.ok(ics.includes('Project\\, part\; one'));
  ics.split('\r\n').forEach(l => assert.ok(Buffer.byteLength(l) <= 75, 'line too long: ' + l));
  assert.ok(!/[^\r]\n/.test(ics), 'bare LF');
});
t('csv escaping', () => assert.ok(SR.toCsv([{ course: 'A', title: 'x, "y"', type: 'exam', date: '2026-10-01', confidence: 'high', source: '' }]).includes('"x, ""y"""')));
console.log(`\n${n} tests passed`);
