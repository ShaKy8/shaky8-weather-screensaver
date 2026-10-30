#!/usr/bin/env node
// Drives the kiosk Chromium started by shaky8-screensaver over the DevTools protocol.
//
//   node shaky8-weather-driver.mjs <port> <url> <view:seconds>...
//
// Exit codes: 0 sequence finished, 10 user input seen (quit the screensaver),
// 20 Chromium or the page never came up (fall back to the logo).

const [port, url, ...steps] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (code) => process.exit(code);

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) pending.get(m.id)(m);
    else listeners.forEach((fn) => fn(m));
  };
  ws.onclose = () => done(20);
  return {
    send: (method, params = {}, sessionId) => new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params, ...(sessionId && { sessionId }) }));
    }),
    on: (fn) => listeners.push(fn),
  };
}

async function waitFor(fn, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v; } catch { /* not up yet */ }
    await sleep(300);
  }
  return null;
}

// Any key, click, wheel, touch, or mouse movement of more than a few pixels.
const INPUT_WATCH = `(() => {
  let moved = 0, last = null;
  const quit = (what) => window.shaky8Input && window.shaky8Input(what);
  for (const t of ['keydown', 'mousedown', 'wheel', 'touchstart']) addEventListener(t, (e) => quit(t + ' key=' + e.key + ' trusted=' + e.isTrusted), true);
  addEventListener('mousemove', (e) => {
    if (last) moved += Math.abs(e.screenX - last[0]) + Math.abs(e.screenY - last[1]);
    last = [e.screenX, e.screenY];
    if (moved > 12) quit('mousemove ' + moved + ' at ' + e.screenX + ',' + e.screenY);
  }, true);
})()`;

const version = await waitFor(async () => (await fetch(`http://127.0.0.1:${port}/json/version`)).json(), 20000);
if (!version) done(20);

const browser = await connect(version.webSocketDebuggerUrl);
const origin = new URL(url).origin;
await browser.send('Browser.grantPermissions', { origin, permissions: ['geolocation'] });

const target = await waitFor(async () => {
  const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  return list.find((t) => t.type === 'page' && t.url.startsWith(origin));
}, 20000);
if (!target) done(20);

const page = await connect(target.webSocketDebuggerUrl);
page.on((m) => {
  if (m.method !== 'Runtime.bindingCalled') return;
  console.error('input:', m.params.payload);
  done(10);
});
await page.send('Runtime.enable');
await page.send('Runtime.addBinding', { name: 'shaky8Input' });
await page.send('Page.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: INPUT_WATCH });
await page.send('Runtime.evaluate', { expression: INPUT_WATCH });

const evaluate = (expression) => page.send('Runtime.evaluate', { expression, returnByValue: true });
const ready = await waitFor(async () => (await evaluate('document.readyState')).result?.result?.value === 'complete', 30000);
if (!ready) done(20);
await sleep(4000); // let the boot sequence and first location settle

for (const step of steps) {
  const [view, secs] = step.split(':');
  await evaluate(`location.hash = ${JSON.stringify(view)}`);
  await sleep(Number(secs) * 1000);
}

await browser.send('Browser.close');
done(0);
