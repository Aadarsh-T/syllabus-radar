# Syllabus Radar

Paste the text of your course syllabi and see the whole semester at once: every dated exam, project, quiz, homework and reading, a week-by-week workload heatmap across all your courses, the "crunch weeks" where several courses pile up, suggested start dates for big items, and a calendar file you can import.

It is a static web page. No login, no server, no network calls, no tracking. Your data is saved only in your own browser (localStorage).

Built for LaunchPad Hacks 2026.

## Run it

- Open `app/index.html` in any modern browser, or
- Serve the folder: `cd app && python3 -m http.server 8000`, then open http://localhost:8000
- GitHub Pages: publish the `app/` folder (or copy its four files plus `samples.js` to the repo root). No build step.

Click **Try 3 sample syllabi** to load three fictional courses (Calculus II, Intro to Programming, General Chemistry) for Fall 2026.

## Files

- `app/index.html`, `app/styles.css` - page and styling (light/dark, phone layout)
- `app/parser.js` - date extraction, classification, workload scoring, .ics and .csv export (works in browser and Node)
- `app/app.js` - UI, review table, heatmap, localStorage
- `app/samples.js` - fictional sample syllabi
- `tests/parser.test.js` - unit tests: `node tests/parser.test.js`
- `tests/e2e.js` - Playwright browser test that also writes the screenshots: serve `app/` on port 8791, then `node tests/e2e.js`

## Supported date formats

`Oct 3`, `October 3rd, 2026`, `3 Oct`, `10/03`, `10/3/26`, `2026-10-03`, `Week 5 Tuesday`, `Wk 5` (Friday assumed), and weekday lines under a `Week 6` heading. Year is inferred from the term start date (so "Jan 5" in a fall term goes to next year). Each item gets a confidence flag (high / medium / low) so you know what to double-check.

## How workload is scored

exam 5, project 4, quiz 2, homework 2, reading 1, other 1. A week is a crunch week if two or more courses have an exam or project in it, or its total score is 10 or more. Suggested start: 14 days before a project, 7 before an exam.

## Credits

Built with AI coding assistance from Claude (Anthropic); design decisions reviewed by the author. Sample syllabi are fictional.

## License

MIT License

Copyright (c) 2026 Syllabus Radar authors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
