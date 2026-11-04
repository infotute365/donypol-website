import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function browserQA({ base, cookie, onCheck, credentials, loginOnly = false, temporaryFiles }) {
  const executable = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  await fs.access(executable);
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'dpvn-pride-browser-'));
  const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9321', '--remote-allow-origins=http://localhost:9321', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let socket; let sequence = 0; const pending = new Map(); const errors = [];
  try {
    let target;
    for (let i = 0; i < 60; i++) {
      try { target = (await (await fetch('http://127.0.0.1:9321/json/list')).json()).find((item) => item.type === 'page'); if (target) break; } catch {}
      await delay(250);
    }
    assert.ok(target, 'Edge remote debugging became ready');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) { const item = pending.get(message.id); pending.delete(message.id); clearTimeout(item.timer); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); }
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
      const value = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (value.exceptionDetails) throw new Error(value.exceptionDetails.text);
      return value.result.value;
    };
    await send('Page.enable'); await send('Runtime.enable');
    async function navigate(route) {
      await send('Page.navigate', { url: base + route });
      for (let i = 0; i < 80; i++) { if (await evaluate(`location.pathname === ${JSON.stringify(route.split('?')[0])} && document.readyState === 'complete'`)) break; await delay(250); }
      await delay(600);
    }
    await fs.mkdir('artifacts', { recursive: true });
    const screenshot = async (name, fullPage = true) => {
      const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage });
      await fs.writeFile(path.join('artifacts', name), Buffer.from(result.data, 'base64'));
    };
    if (credentials) {
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
      await navigate('/admin/login');
      async function fill(name, value) {
        await evaluate(`(() => { const field=document.querySelector('input[name="${name}"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,${JSON.stringify(value)}); field.dispatchEvent(new Event('input',{bubbles:true})); })()`);
      }
      async function until(expression, message) {
        for (let i = 0; i < 80; i++) { if (await evaluate(expression)) return; await delay(250); }
        const diagnostics = await evaluate(`({path:location.pathname, text:document.body.innerText.slice(0,1000), valid:document.querySelector('form')?.checkValidity(), usernamePresent:!!document.querySelector('input[name="username"]')?.value, passwordLength:document.querySelector('input[name="password"]')?.value.length})`);
        assert.fail(`${message}: ${JSON.stringify({ ...diagnostics, runtimeErrors: errors })}`);
      }
      await until(`!!document.querySelector('input[name="username"]') && !document.querySelector('form button').disabled`, 'Login form hydrates and enables sign in');
      await fill('username', credentials.username); await fill('password', credentials.password);
      // Reject only the login fetch, keeping Next's development connection alive.
      await evaluate(`window.__loginTestFetch=window.fetch; window.fetch=(url,options)=>url==='/api/auth/login'?Promise.reject(new TypeError('Simulated network failure')):window.__loginTestFetch(url,options)`);
      await evaluate('document.querySelector("form").requestSubmit()');
      await until(`document.querySelector('[role="alert"]')?.textContent.includes('Could not connect') && !document.querySelector('form button').disabled`, 'Network failures show an error and re-enable sign in');
      await evaluate('window.fetch=window.__loginTestFetch; delete window.__loginTestFetch');
      onCheck(`${base}: browser login recovers from a network failure`);
      await fill('password', 'deliberately-incorrect-test-password');
      await evaluate('document.querySelector("form").requestSubmit()');
      await until(`document.querySelector('[role="alert"]')?.textContent.includes('Invalid credentials') && !document.querySelector('form button').disabled`, 'Invalid credentials show an error and re-enable sign in');
      await fill('password', credentials.password);
      await evaluate('document.querySelector("form").requestSubmit()');
      await until(`location.pathname==='/admin/dashboard' && document.body.innerText.includes('Dashboard overview')`, 'Correct credentials open the authenticated dashboard');
      await screenshot(`admin-login-verified-${new URL(base).hostname.replaceAll('.', '-')}.png`);
      onCheck(`${base}: real browser form accepts the credentials and opens the dashboard`);
      assert.equal(await evaluate(`fetch('/api/auth/logout',{method:'POST'}).then(r=>r.status)`), 200);
      await send('Page.navigate', { url: base + '/admin/dashboard' });
      await until(`location.pathname==='/admin/login' && !!document.querySelector('input[name="username"]')`, 'Logged-out users are redirected to login');
      onCheck(`${base}: logout clears the session and protects the dashboard`);
      assert.deepEqual(errors, []);
      if (loginOnly) return browser;
    }
    for (const width of [1440, 1280, 1024, 768, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
      await navigate('/');
      const sizes = await evaluate(`(() => { const image=document.querySelector('header img'); const nav=document.querySelector('#main-navigation'); const brand=image.closest('a').getBoundingClientRect(); const nr=nav.getBoundingClientRect(); return {height:image.getBoundingClientRect().height, fit:getComputedStyle(image).objectFit, natural:image.naturalWidth, width:document.documentElement.scrollWidth, viewport:innerWidth, overlaps:getComputedStyle(nav).position==='static' && brand.right>nr.left, cards:document.querySelectorAll('article.pride-card').length, alt:image.alt}; })()`);
      assert.ok(sizes.width <= sizes.viewport, `No horizontal overflow at ${width}px: ${sizes.width} > ${sizes.viewport}`);
      assert.equal(sizes.overlaps, false, `Brand and desktop navigation do not overlap at ${width}px`);
      assert.equal(sizes.height, width >= 1280 ? 84 : width >= 768 ? 70 : 56);
      assert.equal(sizes.fit, 'contain'); assert.equal(sizes.cards, 3);
      assert.ok(sizes.natural > 0, 'Original school logo loaded');
      if ([1440, 768, 390].includes(width)) await screenshot(`our-pride-home-${width}.png`);
    }
    onCheck('Edge: original logo loads at 84/70/56px; no header overlap or page overflow at 1440, 1280, 1024, 768, 390 and 320px');
    await evaluate(`document.querySelector('button[aria-controls="main-navigation"]').click()`);
    assert.equal(await evaluate(`document.querySelector('button[aria-controls="main-navigation"]').getAttribute('aria-expanded')`), 'true');
    await evaluate(`document.querySelector('#main-navigation a[href="/gallery"]').click()`);
    await delay(1000);
    assert.equal(await evaluate('location.pathname'), '/gallery');
    assert.equal(await evaluate(`document.querySelector('button[aria-controls="main-navigation"]').getAttribute('aria-expanded')`), 'false');
    onCheck('Edge: mobile navigation opens, navigates and closes correctly');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate('/our-pride');
    assert.equal(await evaluate(`document.querySelectorAll('article.pride-card').length`), 3);
    assert.equal(await evaluate(`document.querySelectorAll('article.pride-card img').length`), 0);
    await screenshot('our-pride-listing-desktop.png');
    onCheck('Edge: public listing renders the original three student cards with initials and no fake photographs');
    const equals = cookie.indexOf('=');
    await send('Network.setCookie', { name: cookie.slice(0, equals), value: cookie.slice(equals + 1), url: base, httpOnly: true, sameSite: 'Lax' });
    await navigate('/admin/dashboard');
    await evaluate(`Array.from(document.querySelectorAll('aside nav button')).find(b=>b.textContent==='Our Pride Management').click()`);
    for (let i = 0; i < 60; i++) { if (await evaluate(`document.body.innerText.includes('3 records')`)) break; await delay(250); }
    assert.ok(await evaluate(`document.body.innerText.includes('Card preview') && document.body.innerText.includes('Nyamme Liza Perme')`));
    await screenshot('our-pride-admin-desktop.png');
    await evaluate(`document.querySelector('button[aria-label="Edit Nyamme Liza Perme"]').click()`);
    await delay(300);
    assert.equal(await evaluate(`document.querySelector('form input').value`), 'Nyamme Liza Perme');
    assert.ok(await evaluate(`document.querySelector('form').parentElement.querySelector('article').innerText.includes('2nd rank in APSBE')`));
    onCheck('Edge: authenticated admin manager loads, edits an original student and renders its live preview');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 1000, deviceScaleFactor: 1, mobile: true });
    await delay(300);
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
    await screenshot('our-pride-admin-mobile.png');
    assert.deepEqual(errors, []);
    onCheck('Edge: admin mobile layout has no horizontal overflow; no runtime exceptions during browser checks');
    const { editorBrowserQA } = await import('./test-editor-browser.mjs');
    await editorBrowserQA({ send, evaluate, screenshot, onCheck, temporaryFiles });
    assert.deepEqual(errors, []);
    return browser;
  } finally {
    if (socket) socket.close();
    if (browser.exitCode === null) { const stopped = new Promise((resolve) => browser.once('exit', resolve)); browser.kill(); await Promise.race([stopped, delay(3000)]); }
    // Verify this generated profile is contained in the OS temporary directory.
    const parent = path.resolve(os.tmpdir()); const resolved = path.resolve(profile);
    if (path.dirname(resolved) === parent && path.basename(resolved).startsWith('dpvn-pride-browser-')) await fs.rm(resolved, { recursive: true, force: true }).catch(() => {});
  }
}
