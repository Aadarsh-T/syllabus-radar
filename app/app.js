/* Syllabus Radar - UI. All processing is local; no network calls. */
(function () {
  'use strict';
  var SR = window.SR, KEY = 'syllabus-radar-v1';
  var $ = function (id) { return document.getElementById(id); };
  var TYPES = ['exam', 'project', 'quiz', 'homework', 'reading', 'other'];
  var state = { termStart: defaultTerm(), courses: [], items: [], startReminders: true };

  function defaultTerm() {
    var now = new Date(), y = now.getFullYear(), m = now.getMonth();
    // Fall term if Jul-Dec, spring term (mid January) otherwise. Users can change it.
    return m >= 6 ? y + '-08-31' : y + '-01-12';
  }
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && Array.isArray(s.items)) state = Object.assign(state, s); } catch (e) { /* storage unavailable */ }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text;
    return e;
  }
  function fmt(isoDate, opts) {
    var d = SR.fromIso(isoDate); if (!d) return isoDate;
    return d.toLocaleDateString(undefined, Object.assign({ month: 'short', day: 'numeric', timeZone: 'UTC' }, opts || {}));
  }
  function say(msg) { $('status').textContent = msg; }
  function uid() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function addSyllabus(course, text) {
    course = (course || '').trim() || 'Course ' + (state.courses.length + 1);
    if (state.courses.indexOf(course) >= 0) { state.items = state.items.filter(function (i) { return i.course !== course; }); }
    else state.courses.push(course);
    var found = SR.parseSyllabus(text, { course: course, termStart: state.termStart });
    found.forEach(function (i) { i.id = uid(); });
    state.items = state.items.concat(found);
    return found;
  }

  function renderCourses() {
    var ul = $('courseList'); ul.textContent = '';
    state.courses.forEach(function (c) {
      var n = state.items.filter(function (i) { return i.course === c; }).length;
      var li = el('li', { class: 'chip' });
      li.appendChild(el('span', null, c + ' · ' + n + ' items'));
      var b = el('button', { type: 'button', 'aria-label': 'Remove ' + c, class: 'x' }, '×');
      b.addEventListener('click', function () {
        state.courses = state.courses.filter(function (x) { return x !== c; });
        state.items = state.items.filter(function (i) { return i.course !== c; });
        say('Removed ' + c + '.'); update();
      });
      li.appendChild(b); ul.appendChild(li);
    });
  }

  function level(score, max) {
    if (!score) return 0;
    var r = score / Math.max(max, 1);
    return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1;
  }

  function renderHeat(w) {
    var t = $('heat'); t.textContent = '';
    var max = 0; w.weeks.forEach(function (wk) { if (wk.total > max) max = wk.total; });
    var maxCourse = 0; w.weeks.forEach(function (wk) { Object.keys(wk.byCourse).forEach(function (c) { if (wk.byCourse[c] > maxCourse) maxCourse = wk.byCourse[c]; }); });
    var cap = t.appendChild(el('caption', { class: 'sr-only' }, 'Workload score by course and week'));
    var thead = t.appendChild(el('thead')), hr = thead.appendChild(el('tr'));
    hr.appendChild(el('th', { scope: 'col', class: 'rowh' }, 'Week'));
    w.weeks.forEach(function (wk) {
      var th = el('th', { scope: 'col', class: wk.crunch ? 'crunch' : '', title: 'Week of ' + fmt(wk.start) });
      th.appendChild(el('span', { class: 'wn' }, String(wk.week)));
      th.appendChild(el('span', { class: 'wd' }, fmt(wk.start)));
      hr.appendChild(th);
    });
    var tb = t.appendChild(el('tbody'));
    w.courses.forEach(function (c) {
      var tr = tb.appendChild(el('tr'));
      tr.appendChild(el('th', { scope: 'row', class: 'rowh' }, c));
      w.weeks.forEach(function (wk) {
        var s = wk.byCourse[c] || 0;
        var names = wk.items.filter(function (i) { return i.course === c; }).map(function (i) { return i.title + ' (' + fmt(i.date) + ')'; });
        var td = el('td', { class: 'l' + level(s, maxCourse) + (wk.crunch ? ' crunch' : ''), title: names.join('\n') || 'Nothing due' }, s ? String(s) : '');
        td.setAttribute('aria-label', c + ', week ' + wk.week + ': ' + (s ? 'score ' + s + '. ' + names.join('; ') : 'nothing due'));
        tr.appendChild(td);
      });
    });
    var tr2 = tb.appendChild(el('tr', { class: 'total' }));
    tr2.appendChild(el('th', { scope: 'row', class: 'rowh' }, 'All courses'));
    w.weeks.forEach(function (wk) {
      var td = el('td', { class: 'l' + level(wk.total, max) + (wk.crunch ? ' crunch' : '') }, wk.total ? String(wk.total) : '');
      td.setAttribute('aria-label', 'Week ' + wk.week + ' total score ' + wk.total + (wk.crunch ? ', crunch week' : ''));
      tr2.appendChild(td);
    });
  }

  function renderCrunch(w) {
    var ol = $('crunchList'); ol.textContent = '';
    var crunch = w.weeks.filter(function (wk) { return wk.crunch; }).sort(function (a, b) { return b.total - a.total; });
    if (!crunch.length) { ol.appendChild(el('li', { class: 'muted' }, 'No crunch weeks found. Nice.')); return; }
    crunch.slice(0, 6).forEach(function (wk) {
      var li = el('li', { class: 'crunch-item' });
      var h = el('p', { class: 'ci-h' });
      h.appendChild(el('strong', null, 'Week ' + wk.week + ' (' + fmt(wk.start) + ')'));
      h.appendChild(document.createTextNode(' · score ' + wk.total));
      li.appendChild(h);
      var ul = el('ul', { class: 'mini' });
      wk.items.slice().sort(function (a, b) { return SR.WEIGHTS[b.type] - SR.WEIGHTS[a.type]; }).forEach(function (i) {
        ul.appendChild(el('li', null, fmt(i.date, { weekday: 'short' }) + ': ' + i.course.split(' ').slice(0, 2).join(' ') + ' ' + i.title));
      });
      li.appendChild(ul);
      var big = wk.items.filter(function (i) { return i.type === 'exam' || i.type === 'project'; });
      if (big.length) {
        var first = big.map(SR.suggestStart).sort()[0];
        var names = big.map(function (i) { return i.course.split(' ').slice(0, 2).join(' ') + ' ' + i.title.split(/[(:,]/)[0].replace(/\bdue\b/i, '').trim(); }).slice(0, 3);
        li.appendChild(el('p', { class: 'advice' }, 'Plan: start on ' + names.join(', ') + ' by ' + fmt(first) + ', and clear the homework due that week before it arrives.'));
      }
      ol.appendChild(li);
    });
  }

  function renderStarts() {
    var ol = $('startList'); ol.textContent = '';
    var today = new Date(); var todayIso = SR.iso(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));
    var big = state.items.filter(function (i) { return i.type === 'exam' || i.type === 'project'; })
      .map(function (i) { return { i: i, s: SR.suggestStart(i) }; })
      .sort(function (a, b) { return a.s < b.s ? -1 : 1; });
    var upcoming = big.filter(function (x) { return x.i.date >= todayIso; });
    var list = (upcoming.length ? upcoming : big).slice(0, 8);
    if (!list.length) { ol.appendChild(el('li', { class: 'muted' }, 'No exams or projects found yet.')); return; }
    list.forEach(function (x) {
      var li = el('li', { class: 'start-item' });
      li.appendChild(el('span', { class: 'sd' }, 'Start ' + fmt(x.s)));
      li.appendChild(el('span', null, x.i.course.split(' ').slice(0, 2).join(' ') + ': ' + x.i.title + ' — due ' + fmt(x.i.date)));
      ol.appendChild(li);
    });
  }

  function renderReview() {
    var tb = $('review').querySelector('tbody'); tb.textContent = '';
    var only = $('onlyReview').checked;
    var rows = state.items.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    rows.forEach(function (it) {
      if (only && it.confidence === 'high') return;
      var tr = el('tr', { class: 'conf-' + it.confidence });
      var label = it.course + ' ' + it.title;
      var d = el('input', { type: 'date', value: it.date, 'aria-label': 'Date for ' + label });
      d.addEventListener('change', function () { if (d.value) { it.date = d.value; it.confidence = 'high'; update(); } });
      var td = el('td'); td.appendChild(d); tr.appendChild(td);
      var cs = el('select', { 'aria-label': 'Course for ' + label });
      state.courses.forEach(function (c) { var o = el('option', { value: c }, c); if (c === it.course) o.selected = true; cs.appendChild(o); });
      cs.addEventListener('change', function () { it.course = cs.value; update(); });
      td = el('td'); td.appendChild(cs); tr.appendChild(td);
      var ti = el('input', { type: 'text', value: it.title, 'aria-label': 'Title for ' + label });
      ti.addEventListener('change', function () { it.title = ti.value; update(); });
      td = el('td', { class: 'titlecell' }); td.appendChild(ti);
      if (it.source) td.appendChild(el('span', { class: 'src' }, '“' + it.source + '”'));
      tr.appendChild(td);
      var ty = el('select', { 'aria-label': 'Type for ' + label });
      TYPES.forEach(function (t) { var o = el('option', { value: t }, t); if (t === it.type) o.selected = true; ty.appendChild(o); });
      ty.addEventListener('change', function () { it.type = ty.value; update(); });
      td = el('td'); td.appendChild(ty); tr.appendChild(td);
      td = el('td');
      if (it.confidence === 'high') td.appendChild(el('span', { class: 'conf high' }, 'high'));
      else {
        var ok = el('button', { type: 'button', class: 'conf ' + it.confidence, 'aria-label': 'Mark ' + label + ' as checked (confidence ' + it.confidence + ')' }, it.confidence + ' ✓');
        ok.addEventListener('click', function () { it.confidence = 'high'; update(); say('Marked "' + it.title + '" as checked.'); });
        td.appendChild(ok);
      }
      tr.appendChild(td);
      var del = el('button', { type: 'button', class: 'x', 'aria-label': 'Delete ' + label }, '×');
      del.addEventListener('click', function () { state.items = state.items.filter(function (x) { return x !== it; }); update(); say('Deleted "' + it.title + '".'); });
      td = el('td'); td.appendChild(del); tr.appendChild(td);
      tb.appendChild(tr);
    });
    if (!tb.children.length) { var r = el('tr'); r.appendChild(el('td', { colspan: '6', class: 'muted' }, 'Nothing to review.')); tb.appendChild(r); }
  }

  function update() {
    save();
    var has = state.items.length > 0;
    ['radarCard', 'reviewCard', 'exportCard'].forEach(function (id) { $(id).hidden = !has; });
    renderCourses();
    if (!has) return;
    var w = SR.workload(state.items, state.termStart);
    renderHeat(w); renderCrunch(w); renderStarts(); renderReview();
  }

  function download(name, mime, text) {
    var blob = new Blob([text], { type: mime }), url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function init() {
    load();
    $('termStart').value = state.termStart;
    $('startReminders').checked = state.startReminders !== false;
    $('termStart').addEventListener('change', function () {
      if (!$('termStart').value) return;
      state.termStart = $('termStart').value; update();
      say('Term start set to ' + fmt(state.termStart, { year: 'numeric' }) + '. Week-based dates use this; re-add a syllabus to re-parse it.');
    });
    $('addBtn').addEventListener('click', function () {
      var text = $('syllabusText').value;
      if (!text.trim()) { say('Paste some syllabus text first.'); $('syllabusText').focus(); return; }
      var found = addSyllabus($('courseName').value, text);
      var low = found.filter(function (i) { return i.confidence !== 'high'; }).length;
      say('Found ' + found.length + ' dated items' + (low ? ', ' + low + ' to double-check.' : '.'));
      $('syllabusText').value = ''; $('courseName').value = '';
      update();
    });
    $('sampleBtn').addEventListener('click', function () {
      state.termStart = '2026-08-31'; $('termStart').value = state.termStart;
      var n = 0; window.SR_SAMPLES.forEach(function (s) { n += addSyllabus(s.course, s.text).length; });
      say('Loaded 3 fictional sample syllabi (Fall 2026): ' + n + ' dated items.');
      update();
      $('radarCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('onlyReview').addEventListener('change', renderReview);
    $('addRowBtn').addEventListener('click', function () {
      if (!state.courses.length) return;
      state.items.push({ id: uid(), course: state.courses[0], title: 'New item', type: 'homework', date: state.termStart, confidence: 'medium', source: '' });
      update(); say('Added a new item dated the first day of term. Edit it in the table.');
    });
    $('startReminders').addEventListener('change', function () { state.startReminders = $('startReminders').checked; save(); });
    $('icsBtn').addEventListener('click', function () {
      download('syllabus-radar.ics', 'text/calendar;charset=utf-8', SR.toIcs(state.items, { startReminders: $('startReminders').checked }));
      say('Calendar file downloaded. Import it in your calendar app.');
    });
    $('csvBtn').addEventListener('click', function () { download('syllabus-radar.csv', 'text/csv;charset=utf-8', SR.toCsv(state.items)); say('CSV downloaded.'); });
    $('clearBtn').addEventListener('click', function () {
      if (!window.confirm('Remove all courses and dates from this device?')) return;
      state.courses = []; state.items = []; update(); say('All data cleared.');
    });
    update();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
