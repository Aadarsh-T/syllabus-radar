/* Syllabus Radar - client-side syllabus date parser. No network, no dependencies.
   Works in the browser (window.SR) and in Node (module.exports). */
(function (root) {
  'use strict';
  var MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, sept:8, oct:9, nov:10, dec:11 };
  var DAYS = { sun:0, mon:1, tue:2, tues:2, wed:3, thu:4, thur:4, thurs:4, fri:5, sat:6 };
  var MON_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
  var DAY_RE = '(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)\\b\\.?';

  var TYPES = [
    { type: 'exam', re: /\b(final exam|midterm|exam|test)\b/i },
    { type: 'homework', re: /\blab reports?\b/i },
    { type: 'project', re: /\bfinal (project|paper|essay|presentation)s?\b/i },
    { type: 'exam', re: /\bfinal\b/i },
    { type: 'project', re: /\b(project|paper|essay|presentation|proposal|report|portfolio|capstone)\b/i },
    { type: 'quiz', re: /\b(quiz|quizzes)\b/i },
    { type: 'homework', re: /\b(homework|hw\s*\d*|assignment|problem set|pset|ps\s*\d+|lab\s*\d*|worksheet|due)\b/i },
    { type: 'reading', re: /\b(read(ing)?|chapter|ch\.\s*\d+|textbook|article)\b/i }
  ];
  var WEIGHTS = { exam: 5, project: 4, quiz: 2, homework: 2, reading: 1, other: 1 };
  var LEAD_DAYS = { exam: 7, project: 14, quiz: 2, homework: 3, reading: 1, other: 1 };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function fromIso(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  }
  function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
  function valid(y, mo, da) {
    var d = new Date(Date.UTC(y, mo, da));
    return d.getUTCMonth() === mo && d.getUTCDate() === da ? d : null;
  }
  function monthIdx(s) { var k = s.toLowerCase().replace('.', ''); return MONTHS[k.slice(0, k.indexOf('sept') === 0 ? 4 : 3)]; }
  function dayIdx(s) { return DAYS[s.toLowerCase().replace('.', '').slice(0, 3)]; }

  /* Pick a year for a month/day with no year: the one that lands closest to the term. */
  function inferYear(mo, da, termStart) {
    var y = termStart.getUTCFullYear(), best = null, bestDist = Infinity;
    [y - 1, y, y + 1].forEach(function (yy) {
      var d = valid(yy, mo, da); if (!d) return;
      var dist = Math.abs(d - addDays(termStart, 60));
      if (dist < bestDist) { bestDist = dist; best = d; }
    });
    return best;
  }

  /* Week N (+ weekday) relative to term start. Week 1 = week containing term start. */
  function weekDate(week, weekday, termStart) {
    var monday = addDays(termStart, -((termStart.getUTCDay() + 6) % 7));
    var offset = weekday == null ? 4 : (weekday + 6) % 7; // default Friday
    return addDays(monday, (week - 1) * 7 + offset);
  }

  /* Find a date inside one line of text. Returns {date, kind, match} or null. */
  function findDate(line, termStart) {
    var m;
    if ((m = /\b(20\d\d)-(\d{1,2})-(\d{1,2})\b/.exec(line))) {
      var d0 = valid(+m[1], +m[2] - 1, +m[3]); if (d0) return { date: d0, kind: 'explicit', match: m[0] };
    }
    if ((m = new RegExp('\\b' + MON_RE + '\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s*(20\\d\\d))?', 'i').exec(line))) {
      var mo = monthIdx(m[1]), da = +m[2];
      var d1 = m[3] ? valid(+m[3], mo, da) : inferYear(mo, da, termStart);
      if (d1) return { date: d1, kind: 'explicit', match: m[0] };
    }
    if ((m = new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+' + MON_RE + '(?:\\s+(20\\d\\d))?', 'i').exec(line))) {
      var mo2 = monthIdx(m[2]), da2 = +m[1];
      var d2 = m[3] ? valid(+m[3], mo2, da2) : inferYear(mo2, da2, termStart);
      if (d2) return { date: d2, kind: 'explicit', match: m[0] };
    }
    if ((m = /(?:^|[^\d\/.])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\d\/])/.exec(line))) {
      var mo3 = +m[1] - 1, da3 = +m[2], yr = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : null;
      var d3 = yr ? valid(yr, mo3, da3) : (mo3 >= 0 && mo3 < 12 ? inferYear(mo3, da3, termStart) : null);
      if (d3) return { date: d3, kind: 'explicit', match: m[0].replace(/^[^\d]/, '') };
    }
    if ((m = new RegExp('\\b(?:week|wk)\\.?\\s*(\\d{1,2})\\b(?:[\\s,:\\-\\u2013(]*' + DAY_RE + ')?', 'i').exec(line))) {
      var wd = m[2] ? dayIdx(m[2]) : null;
      return { date: weekDate(+m[1], wd, termStart), kind: wd == null ? 'week' : 'weekday', match: m[0], week: +m[1] };
    }
    return null;
  }

  function classify(text) {
    for (var i = 0; i < TYPES.length; i++) if (TYPES[i].re.test(text)) return TYPES[i].type;
    return 'other';
  }

  function cleanTitle(line, match) {
    var t = line.replace(match, ' ').replace(/\s*\|\s*/g, ' - ').replace(/\s+([,;:])/g, '$1').replace(/([:\-])\s*,/g, '$1').replace(/^[\s\-*\u2022|:,.;]+|[\s\-*\u2022|:,.;]+$/g, '')
      .replace(/\b(due|on|by)\s*$/i, '').replace(/\s{2,}/g, ' ').replace(/^[\-:\u2013]\s*/, '').trim();
    return t.length > 90 ? t.slice(0, 87) + '...' : t;
  }

  /* Parse one syllabus. opts: {course, termStart: 'YYYY-MM-DD'} */
  function parseSyllabus(text, opts) {
    opts = opts || {};
    var termStart = fromIso(opts.termStart) || new Date(Date.UTC(new Date().getFullYear(), 8, 1));
    var items = [], currentWeek = null;
    String(text || '').split(/\r?\n/).forEach(function (raw, lineNo) {
      var line = raw.trim(); if (!line) return;
      var found = findDate(line, termStart);
      var type = classify(line);
      // A heading like "Week 6" with no task words sets context for following lines.
      if (found && found.week && type === 'other') { currentWeek = found.week; return; }
      if (found && found.week) currentWeek = found.week;
      if (!found && currentWeek) {
        var dm = new RegExp('\\b' + DAY_RE, 'i').exec(line);
        if (dm && type !== 'other') found = { date: weekDate(currentWeek, dayIdx(dm[1]), termStart), kind: 'context', match: dm[0] };
      }
      if (!found) return;
      if (type === 'other' && !/\b(due|submit|turn in|deadline|presentations?|no class|holiday|break)\b/i.test(line)) return;
      if (/\b(no class|holiday|break|recess)\b/i.test(line) && type !== 'exam') return;
      var confidence = found.kind === 'explicit' ? (type === 'other' ? 'medium' : 'high')
        : found.kind === 'weekday' ? 'medium' : 'low';
      items.push({
        id: (opts.course || 'c') + '-' + lineNo,
        course: opts.course || 'Course',
        title: cleanTitle(line, found.match) || type,
        type: type,
        date: iso(found.date),
        confidence: confidence,
        source: line
      });
    });
    return items;
  }

  function weekIndex(dateIso, termStartIso) {
    var d = fromIso(dateIso), t = fromIso(termStartIso);
    var monday = addDays(t, -((t.getUTCDay() + 6) % 7));
    return Math.floor((d - monday) / (7 * 86400000)) + 1;
  }

  /* Aggregate workload by week. Returns {weeks:[{week, start, total, byCourse, items, crunch}], courses} */
  function workload(items, termStartIso, nWeeks) {
    nWeeks = nWeeks || 16;
    var t = fromIso(termStartIso), monday = addDays(t, -((t.getUTCDay() + 6) % 7));
    var courses = [], weeks = [];
    items.forEach(function (it) { if (courses.indexOf(it.course) < 0) courses.push(it.course); });
    var maxWeek = nWeeks;
    items.forEach(function (it) { var w = weekIndex(it.date, termStartIso); if (w > maxWeek && w < 30) maxWeek = w; });
    for (var w = 1; w <= maxWeek; w++) weeks.push({ week: w, start: iso(addDays(monday, (w - 1) * 7)), total: 0, byCourse: {}, items: [], crunch: false, reasons: [] });
    items.forEach(function (it) {
      var w = weekIndex(it.date, termStartIso); if (w < 1 || w > maxWeek) return;
      var wk = weeks[w - 1], wt = WEIGHTS[it.type] || 1;
      wk.total += wt; wk.byCourse[it.course] = (wk.byCourse[it.course] || 0) + wt; wk.items.push(it);
    });
    weeks.forEach(function (wk) {
      var big = wk.items.filter(function (i) { return i.type === 'exam' || i.type === 'project'; });
      var bigCourses = {}; big.forEach(function (i) { bigCourses[i.course] = 1; });
      var nBig = Object.keys(bigCourses).length;
      if (nBig >= 2) { wk.crunch = true; wk.reasons.push(nBig + ' courses have exams or projects'); }
      if (wk.total >= 10) { wk.crunch = true; wk.reasons.push('workload score ' + wk.total); }
    });
    return { weeks: weeks, courses: courses };
  }

  function suggestStart(item) {
    var d = fromIso(item.date); if (!d) return null;
    return iso(addDays(d, -(LEAD_DAYS[item.type] || 1)));
  }

  /* ---- RFC 5545 export ---- */
  function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function fold(line) {
    // Fold at 75 octets (UTF-8 aware), continuation lines start with a space.
    var out = [], cur = '', bytes = 0;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i], cp = line.codePointAt(i);
      if (cp > 0xffff) { ch = line.slice(i, i + 2); i++; }
      var b = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
      var limit = out.length ? 74 : 75;
      if (bytes + b > limit) { out.push(cur); cur = ''; bytes = 0; }
      cur += ch; bytes += b;
    }
    out.push(cur);
    return out.join('\r\n ');
  }
  function toIcs(items, opts) {
    opts = opts || {};
    var stamp = (opts.now || new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Syllabus Radar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Syllabus Radar'];
    function ev(uid, dateIso, summary, desc) {
      var d = fromIso(dateIso); if (!d) return;
      L.push('BEGIN:VEVENT', 'UID:' + uid + '@syllabus-radar', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + dateIso.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + iso(addDays(d, 1)).replace(/-/g, ''),
        'SUMMARY:' + icsEscape(summary), 'DESCRIPTION:' + icsEscape(desc), 'TRANSP:TRANSPARENT', 'END:VEVENT');
    }
    items.forEach(function (it, i) {
      var uid = 'sr-' + i + '-' + it.date.replace(/-/g, '') + '-' + String(it.course).replace(/[^A-Za-z0-9]/g, '');
      ev(uid, it.date, '[' + it.course + '] ' + it.title, 'Type: ' + it.type + '\nFrom syllabus: ' + (it.source || ''));
      if (opts.startReminders && (it.type === 'exam' || it.type === 'project')) {
        var s = suggestStart(it);
        ev(uid + '-start', s, 'Start: [' + it.course + '] ' + it.title, 'Suggested start date (' + LEAD_DAYS[it.type] + ' days before ' + it.date + ')');
      }
    });
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }

  function csvCell(s) { s = String(s == null ? '' : s); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function toCsv(items) {
    var rows = [['course', 'date', 'type', 'title', 'confidence', 'suggested_start', 'source']];
    items.forEach(function (it) { rows.push([it.course, it.date, it.type, it.title, it.confidence, suggestStart(it), it.source]); });
    return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }

  var api = { parseSyllabus: parseSyllabus, findDate: findDate, classify: classify, workload: workload,
    weekIndex: weekIndex, suggestStart: suggestStart, toIcs: toIcs, toCsv: toCsv, fold: fold,
    WEIGHTS: WEIGHTS, LEAD_DAYS: LEAD_DAYS, iso: iso, fromIso: fromIso };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SR = api;
})(this);
