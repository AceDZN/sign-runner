// Real-time frame rate on the built game. Needs `npm run preview` (port 4211).
// Usage: node tests/perf.mjs [url]
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:4211/?test';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const out = [];
for (const [name, viewport] of [['desktop 1672x941', { width: 1672, height: 941 }], ['phone 390x844', { width: 390, height: 844 }]]) {
  const p = await (await browser.newContext({ viewport, deviceScaleFactor: name.startsWith('phone') ? 2 : 1 })).newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.goto(url);
  await p.waitForTimeout(3500);
  for (const lvl of [0, 1, 6]) {
    await p.evaluate((i) => window.__signRunner.start(i), lvl);
    await p.waitForTimeout(1500);
    const r = await p.evaluate(() => new Promise((res) => {
      const ts = [];
      const f = (t) => { ts.push(t); if (ts.length < 400) requestAnimationFrame(f); else res(ts); };
      requestAnimationFrame(f);
    }));
    const d = r.slice(1).map((t, i) => t - r[i]).sort((a, b) => a - b);
    const avg = (r[r.length - 1] - r[0]) / (r.length - 1);
    out.push({ viewport: name, level: lvl + 1, fps: +(1000 / avg).toFixed(1), p95FrameMs: +d[Math.floor(d.length * 0.95)].toFixed(1), state: JSON.parse(await p.evaluate(() => window.render_game_to_text())).phase });
  }
  out.push({ viewport: name, errors });
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
