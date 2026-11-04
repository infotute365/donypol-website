import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export async function editorBrowserQA({ send, evaluate, screenshot, onCheck, temporaryFiles }) {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function until(expression, label) {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(250); }
    const context = await evaluate(`({text:document.body.innerText.slice(-1800),frame:document.querySelector('iframe[title="Live website draft preview"]')?.contentDocument?.body.innerText.slice(0,500)})`);
    assert.fail(label + ': ' + JSON.stringify(context));
  }
  async function fill(selector, value, select = false) {
    await evaluate(`(() => { const field=document.querySelector(${JSON.stringify(selector)}); field.focus(); Object.getOwnPropertyDescriptor(${select ? 'HTMLSelectElement' : 'HTMLInputElement'}.prototype,'value').set.call(field,${JSON.stringify(value)}); field.dispatchEvent(new Event('${select ? 'change' : 'input'}',{bubbles:true})); })()`);
  }
  const frame = `document.querySelector('iframe[title="Live website draft preview"]')?.contentDocument`;
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
  await evaluate(`Array.from(document.querySelectorAll('aside nav button')).find(button=>button.textContent==='Website editor').click()`);
  await until(`${frame}?.querySelector('.heritage-hero') && document.body.innerText.includes('Draft preview is up to date')`, 'Private homepage loads in the editor iframe');
  assert.ok(await evaluate(`document.body.innerText.includes('Editing: Home page') && document.body.innerText.includes('school_gate.jpeg')`));
  await screenshot('website-editor-desktop.png', false);
  onCheck('Edge: website editor identifies the page and current image filename and embeds a working private homepage preview');
  const draftTitle = 'Homepage preview example - unpublished';
  await fill('[data-field="pages.home.heroTitle"]', draftTitle);
  await until(`${frame}?.querySelector('h1')?.textContent===${JSON.stringify(draftTitle)}`, 'Unsaved heading appears in the iframe');
  assert.ok(await evaluate(`document.body.innerText.includes('Hero Title') && document.body.innerText.includes('Unsaved changes')`));
  assert.equal(await evaluate(`fetch('/').then(r=>r.text()).then(text=>text.includes(${JSON.stringify(draftTitle)}))`), false);
  await screenshot('website-editor-draft-preview.png', false);
  await fill('select[aria-label="Page or section to edit"]', 'about', true);
  await until(`${frame}?.querySelector('h1')?.textContent==='About us'`, 'About page loads inside preview');
  await fill('[data-field="pages.about.pageTitle"]', 'About our school - preview');
  await until(`${frame}?.querySelector('h1')?.textContent==='About our school - preview'`, 'About page reflects its unsaved title');
  assert.ok(await evaluate(`document.body.innerText.includes('Editing: About page')`));
  await fill('select[aria-label="Page or section to edit"]', 'home', true);
  await until(`${frame}?.querySelector('h1')?.textContent===${JSON.stringify(draftTitle)}`, 'Returning to Home preserves draft edits');
  onCheck('Edge: unsaved edits update the real website preview, stay off the public site and persist when switching edited pages');
  await evaluate(`document.querySelector('button[aria-label="Mobile preview"]').click()`);
  assert.equal(await evaluate(`document.querySelector('iframe[title="Live website draft preview"]').style.width`), '390px');
  await evaluate(`document.querySelector('button[aria-label="Tablet preview"]').click()`);
  assert.equal(await evaluate(`document.querySelector('iframe[title="Live website draft preview"]').style.width`), '768px');
  await evaluate(`document.querySelector('button[aria-label="Desktop preview"]').click()`);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 1000, deviceScaleFactor: 1, mobile: true });
  await evaluate(`document.querySelector('button[aria-label="Mobile preview"]').click()`);
  await delay(300);
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  await screenshot('website-editor-mobile.png', false);
  onCheck('Edge: desktop/tablet/mobile preview controls work and the editor fits a 390px screen');
  const fixture = path.join(os.tmpdir(), `dpvn-editor-${Date.now()}.png`);
  try {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
    await fs.writeFile(fixture, png);
    const before = await evaluate(`fetch('/api/content').then(r=>r.json()).then(r=>r.content.pages.images.schoolGate)`);
    const root = await send('DOM.getDocument');
    const input = await send('DOM.querySelector', { nodeId: root.root.nodeId, selector: 'input[aria-label="Replace homepage background"]' });
    await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [fixture] });
    await until(`document.querySelector('img[alt="Current homepage background"]').getAttribute('src').startsWith('/api/media/image?')`, 'Background upload updates the draft');
    const background = await evaluate(`document.querySelector('img[alt="Current homepage background"]').getAttribute('src')`);
    const storedName = new URL(background, 'https://school.invalid').searchParams.get('file');
    temporaryFiles?.add(storedName);
    await until(`${frame}?.querySelector('.heritage-hero')?.style.backgroundImage.includes(${JSON.stringify(storedName)})`, 'Uploaded background appears in the private preview');
    assert.equal(await evaluate(`fetch(${JSON.stringify(background)}).then(r=>r.status)`), 200);
    assert.equal(await evaluate(`fetch('/').then(r=>r.text()).then(text=>text.includes(${JSON.stringify(storedName)}))`), false);
    await evaluate(`Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Publish website changes').click()`);
    await until(`document.body.innerText.includes('Website content published successfully.') && document.body.innerText.includes('No unpublished changes')`, 'Publishing saves the draft');
    assert.equal(await evaluate(`fetch('/').then(r=>r.text()).then(text=>text.includes(${JSON.stringify(draftTitle)}) && text.includes(${JSON.stringify(storedName)}))`), true);
    assert.equal(await evaluate(`fetch('/api/content').then(r=>r.json()).then(r=>r.content.pages.images.schoolGate)`), before);
    await fill('[data-field="pages.home.heroTitle"]', 'Discard this unpublished edit');
    await evaluate(`(() => { const original=window.confirm; window.confirm=()=>true; Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Discard changes').click(); window.confirm=original; })()`);
    await until(`document.querySelector('[data-field="pages.home.heroTitle"]').value===${JSON.stringify(draftTitle)}`, 'Discard restores the last published version');
    onCheck('Edge: background upload, draft preview, publishing and discarding work through the admin UI without changing the shared school photo');
  } finally { await fs.unlink(fixture).catch(() => {}); }
}
