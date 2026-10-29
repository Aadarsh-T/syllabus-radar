// Run: (cd app && python3 -m http.server 8791) & node tests/e2e.js
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const assert = require('assert');
const URL = process.env.URL || 'http://localhost:8791/index.html';
const SHOTS = path.join(__dirname, '..', 'screenshots');
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { if (!r.url().startsWith('http://localhost') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) errors.push('external request: ' + r.url()); });
  await page.goto(URL);
  await page.screenshot({ path: path.join(SHOTS, '1-start.png') });
  // Manual paste flow
  await page.fill('#courseName', 'PHYS 1151 Physics for Engineers');
  await page.fill('#syllabusText', 'Sep 18 - Problem set 1 due\nOctober 14th: Midterm exam\nWeek 9 Friday: Lab report 3 due\n11/20 Final project due');
  await page.click('#addBtn');
  assert.match(await page.textContent('#status'), /Found 4 dated items/);
  // Samples
  await page.click('#sampleBtn');
  assert.strictEqual(await page.locator('#courseList li').count(), 4);
  await page.locator('#crunchList li').first().waitFor();
  await page.evaluate(() => window.scrollTo(0, document.getElementById('radarCard').offsetTop - 8));
  await page.screenshot({ path: path.join(SHOTS, '2-radar.png') });
  // Review: filter + edit
  await page.check('#onlyReview');
  const reviewRows = await page.locator('#review tbody tr').count();
  assert.ok(reviewRows > 0);
  await page.locator('#review tbody tr').first().locator('button.conf').click();
  assert.strictEqual(await page.locator('#review tbody tr').count(), reviewRows - 1);
  await page.evaluate(() => window.scrollTo(0, document.getElementById('reviewCard').offsetTop - 8));
  await page.screenshot({ path: path.join(SHOTS, '3-review.png') });
  await page.uncheck('#onlyReview');
  // Keyboard: tab reaches the sample button
  await page.focus('#addBtn'); await page.keyboard.press('Tab');
  assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'sampleBtn');
  // Exports
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#icsBtn')]);
  const icsPath = path.join(__dirname, 'out.ics'); await dl.saveAs(icsPath);
  const ics = fs.readFileSync(icsPath, 'utf8');
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0'));
  const nEv = (ics.match(/BEGIN:VEVENT/g) || []).length; assert.ok(nEv > 30, 'events ' + nEv);
  ics.split('\r\n').forEach(l => assert.ok(Buffer.byteLength(l) <= 75));
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#csvBtn')]);
  const csv = fs.readFileSync(await dl2.path(), 'utf8'); assert.ok(csv.startsWith('course,date,type'));
  await page.evaluate(() => window.scrollTo(0, document.getElementById('exportCard').offsetTop - 300));
  await page.screenshot({ path: path.join(SHOTS, '4-export.png') });
  // Persistence
  await page.reload();
  assert.strictEqual(await page.locator('#courseList li').count(), 4, 'localStorage persistence');
  // Phone
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const p2 = await phone.newPage();
  p2.on('pageerror', e => errors.push(String(e)));
  p2.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p2.goto(URL); await p2.click('#sampleBtn'); await p2.waitForTimeout(600);
  const overflow = await p2.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.ok(!overflow, 'horizontal page scroll on phone');
  await p2.evaluate(() => window.scrollTo(0, document.getElementById('radarCard').offsetTop - 8));
  await p2.screenshot({ path: path.join(SHOTS, '5-phone.png') });
  // Dark mode
  const dark = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark' });
  const p3 = await dark.newPage(); await p3.goto(URL); await p3.click('#sampleBtn'); await p3.waitForTimeout(600);
  await p3.evaluate(() => window.scrollTo(0, document.getElementById('radarCard').offsetTop - 8));
  await p3.screenshot({ path: path.join(SHOTS, '6-dark.png') });
  await browser.close();
  fs.unlinkSync(icsPath);
  if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
  console.log('e2e ok:', nEv, 'ics events, review rows', reviewRows);
})().catch(e => { console.error(e); process.exit(1); });
