import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function browserQA({
  base,
  cookie,
  onCheck,
  credentials,
  galleryAlbumTitle,
  galleryAlbumDescription,
  loginOnly = false,
  temporaryFiles,
}) {
  const executable =
    process.env.EDGE_PATH ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  await fs.access(executable);
  const profile = await fs.mkdtemp(
    path.join(os.tmpdir(), "dpvn-pride-browser-"),
  );
  const browser = spawn(
    executable,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=9321",
      "--remote-allow-origins=http://localhost:9321",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  let socket;
  let sequence = 0;
  const pending = new Map();
  const errors = [];
  try {
    let target;
    for (let i = 0; i < 60; i++) {
      try {
        target = (
          await (await fetch("http://127.0.0.1:9321/json/list")).json()
        ).find((item) => item.type === "page");
        if (target) break;
      } catch {}
      await delay(250);
    }
    assert.ok(target, "Edge remote debugging became ready");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const item = pending.get(message.id);
        pending.delete(message.id);
        clearTimeout(item.timer);
        message.error
          ? item.reject(new Error(message.error.message))
          : item.resolve(message.result);
      }
      if (message.method === "Runtime.exceptionThrown")
        errors.push(
          message.params.exceptionDetails.exception?.description ||
            message.params.exceptionDetails.text,
        );
    });
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }, 20000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    const evaluate = async (expression) => {
      const value = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (value.exceptionDetails) throw new Error(value.exceptionDetails.text);
      return value.result.value;
    };
    await send("Page.enable");
    await send("Runtime.enable");
    async function navigate(route) {
      await send("Page.navigate", { url: base + route });
      for (let i = 0; i < 80; i++) {
        if (
          await evaluate(
            `location.pathname === ${JSON.stringify(route.split("?")[0])} && document.readyState === 'complete'`,
          )
        )
          break;
        await delay(250);
      }
      await delay(600);
    }
    await fs.mkdir("artifacts", { recursive: true });
    const screenshot = async (name, fullPage = true) => {
      const result = await send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: fullPage,
      });
      await fs.writeFile(
        path.join("artifacts", name),
        Buffer.from(result.data, "base64"),
      );
    };
    if (credentials) {
      await send("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await navigate("/admin/login");
      async function fill(name, value) {
        await evaluate(
          `(() => { const field=document.querySelector('input[name="${name}"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,${JSON.stringify(value)}); field.dispatchEvent(new Event('input',{bubbles:true})); })()`,
        );
      }
      async function until(expression, message) {
        for (let i = 0; i < 80; i++) {
          if (await evaluate(expression)) return;
          await delay(250);
        }
        const diagnostics = await evaluate(
          `({path:location.pathname, text:document.body.innerText.slice(0,1000), valid:document.querySelector('form')?.checkValidity(), usernamePresent:!!document.querySelector('input[name="username"]')?.value, passwordLength:document.querySelector('input[name="password"]')?.value.length})`,
        );
        assert.fail(
          `${message}: ${JSON.stringify({ ...diagnostics, runtimeErrors: errors })}`,
        );
      }
      await until(
        `!!document.querySelector('input[name="username"]') && !document.querySelector('form button').disabled`,
        "Login form hydrates and enables sign in",
      );
      await fill("username", credentials.username);
      await fill("password", credentials.password);
      // Reject only the login fetch, keeping Next's development connection alive.
      await evaluate(
        `window.__loginTestFetch=window.fetch; window.fetch=(url,options)=>url==='/api/auth/login'?Promise.reject(new TypeError('Simulated network failure')):window.__loginTestFetch(url,options)`,
      );
      await evaluate('document.querySelector("form").requestSubmit()');
      await until(
        `document.querySelector('[role="alert"]')?.textContent.includes('Could not connect') && !document.querySelector('form button').disabled`,
        "Network failures show an error and re-enable sign in",
      );
      await evaluate(
        "window.fetch=window.__loginTestFetch; delete window.__loginTestFetch",
      );
      onCheck(`${base}: browser login recovers from a network failure`);
      await fill("password", "deliberately-incorrect-test-password");
      await evaluate('document.querySelector("form").requestSubmit()');
      await until(
        `document.querySelector('[role="alert"]')?.textContent.includes('Invalid credentials') && !document.querySelector('form button').disabled`,
        "Invalid credentials show an error and re-enable sign in",
      );
      await fill("password", credentials.password);
      await evaluate('document.querySelector("form").requestSubmit()');
      await until(
        `location.pathname==='/admin/dashboard' && document.body.innerText.includes('Dashboard overview')`,
        "Correct credentials open the authenticated dashboard",
      );
      await screenshot(
        `admin-login-verified-${new URL(base).hostname.replaceAll(".", "-")}.png`,
      );
      onCheck(
        `${base}: real browser form accepts the credentials and opens the dashboard`,
      );
      assert.equal(
        await evaluate(
          `fetch('/api/auth/logout',{method:'POST'}).then(r=>r.status)`,
        ),
        200,
      );
      await send("Page.navigate", { url: base + "/admin/dashboard" });
      await until(
        `location.pathname==='/admin/login' && !!document.querySelector('input[name="username"]')`,
        "Logged-out users are redirected to login",
      );
      onCheck(`${base}: logout clears the session and protects the dashboard`);
      assert.deepEqual(errors, []);
      if (loginOnly) return browser;
    }
    for (const width of [1440, 1280, 1024, 768, 390, 375, 320]) {
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: width < 768,
      });
      await navigate("/");
      const sizes = await evaluate(
        `(() => { const image=document.querySelector('header img'); const logo=image||document.querySelector('header [role="img"]'); const nav=document.querySelector('#main-navigation'); const brand=logo.closest('a').getBoundingClientRect(); const nr=nav.getBoundingClientRect(); return {height:logo.getBoundingClientRect().height, fit:image?getComputedStyle(image).objectFit:null, natural:image?.naturalWidth||0, fallback:!image&&logo.textContent.trim(), width:document.documentElement.scrollWidth, viewport:innerWidth, overlaps:getComputedStyle(nav).position==='static' && brand.right>nr.left, cards:document.querySelectorAll('article.pride-card').length, alt:image?.alt||logo.getAttribute('aria-label')}; })()`,
      );
      assert.ok(
        sizes.width <= sizes.viewport,
        `No horizontal overflow at ${width}px: ${sizes.width} > ${sizes.viewport}`,
      );
      assert.equal(
        sizes.overlaps,
        false,
        `Brand and desktop navigation do not overlap at ${width}px`,
      );
      assert.equal(sizes.height, width >= 1280 ? 84 : width >= 768 ? 70 : 56);
      assert.equal(sizes.fit, sizes.fallback ? null : "contain");
      assert.equal(sizes.cards, 3);
      assert.ok(
        sizes.natural > 0 || sizes.fallback === "DPVN",
        "The logo loads or renders its fallback",
      );
      if ([1440, 768, 390, 375].includes(width))
        await screenshot(`our-pride-home-${width}.png`);
    }
    onCheck(
      "Edge: logo or fallback stays responsive; no header overlap or overflow at 1440, 1280, 1024, 768, 390, 375 and 320px",
    );
    await evaluate(
      `Array.from(document.querySelectorAll('header img, footer img')).forEach((image,index)=>{image.src='/__broken-school-logo-test-'+index+'.png'})`,
    );
    for (let i = 0; i < 40; i++) {
      if (
        await evaluate(
          `document.querySelector('header [role="img"]')?.textContent.trim()==='DPVN' && document.querySelector('footer [role="img"]')?.textContent.trim()==='DPVN'`,
        )
      )
        break;
      await delay(250);
    }
    assert.equal(
      await evaluate(
        `document.querySelector('header [role="img"]')?.textContent.trim()`,
      ),
      "DPVN",
    );
    assert.equal(
      await evaluate(
        `document.querySelector('footer [role="img"]')?.textContent.trim()`,
      ),
      "DPVN",
    );
    onCheck(
      "Edge: broken header/footer logo URLs switch to the school-crest fallback",
    );
    await evaluate(
      `document.querySelector('button[aria-controls="main-navigation"]').click()`,
    );
    assert.equal(
      await evaluate(
        `document.querySelector('button[aria-controls="main-navigation"]').getAttribute('aria-expanded')`,
      ),
      "true",
    );
    await evaluate(
      `document.querySelector('#main-navigation a[href="/gallery"]').click()`,
    );
    await delay(1000);
    assert.equal(await evaluate("location.pathname"), "/gallery");
    assert.equal(
      await evaluate(
        `document.querySelector('button[aria-controls="main-navigation"]').getAttribute('aria-expanded')`,
      ),
      "false",
    );
    onCheck("Edge: mobile navigation opens, navigates and closes correctly");
    const hasUploadedGalleryAlbum = await evaluate(
      `Array.from(document.querySelectorAll('h2')).some(heading=>heading.textContent===${JSON.stringify(galleryAlbumTitle)})`,
    );
    assert.equal(hasUploadedGalleryAlbum, true);
    assert.equal(
      await evaluate(
        `Array.from(document.querySelectorAll('section')).some(section=>section.querySelector('h2')?.textContent===${JSON.stringify(galleryAlbumTitle)} && section.textContent.includes(${JSON.stringify(galleryAlbumDescription)}))`,
      ),
      true,
    );
    await evaluate(
      `(() => { const heading=Array.from(document.querySelectorAll('h2')).find(item=>item.textContent===${JSON.stringify(galleryAlbumTitle)}); heading.closest('section').querySelector('button').click(); })()`,
    );
    const lightboxImage = await evaluate(
      `document.querySelector('div.fixed.inset-0 img')?.getAttribute('src')`,
    );
    assert.ok(lightboxImage?.includes("/api/media/image?file="));
    assert.ok(
      await evaluate(`!!document.querySelector('button[aria-label="Next"]')`),
    );
    await evaluate(
      `document.querySelector('button[aria-label="Next"]').click()`,
    );
    const nextLightboxImage = await evaluate(
      `document.querySelector('div.fixed.inset-0 img')?.getAttribute('src')`,
    );
    assert.notEqual(nextLightboxImage, lightboxImage);
    await evaluate(
      `document.querySelector('button[aria-label="Previous"]').click()`,
    );
    assert.equal(
      await evaluate(
        `document.querySelector('div.fixed.inset-0 img')?.getAttribute('src')`,
      ),
      lightboxImage,
    );
    await evaluate(
      `document.querySelector('button[aria-label="Close"]').click()`,
    );
    assert.equal(
      await evaluate(`!!document.querySelector('div.fixed.inset-0')`),
      false,
    );
    onCheck(
      "Edge: newly uploaded gallery photos open in the lightbox and next/previous/close controls work",
    );
    await navigate("/gallery?page=2");
    assert.equal(
      await evaluate(
        `document.querySelector('nav[aria-label="Gallery pages"] a.bg-ink')?.textContent`,
      ),
      "2",
    );
    assert.ok(
      await evaluate(
        `!!document.querySelector('nav[aria-label="Gallery pages"]')`,
      ),
    );
    onCheck("Edge: gallery pagination opens page two and marks it active");
    await navigate("/gallery");
    await evaluate(
      `document.querySelector('button.group img')?.setAttribute('src','/__broken-gallery-test__.jpg')`,
    );
    for (let i = 0; i < 40; i++) {
      if (
        await evaluate(`document.body.innerText.includes('Photo unavailable')`)
      )
        break;
      await delay(250);
    }
    assert.ok(
      await evaluate(
        `document.body.innerText.includes('School Photograph Coming Soon')`,
      ),
    );
    assert.ok(
      await evaluate(
        `!!document.querySelector('button[disabled][aria-label^="Photograph"][role="img"]') || Array.from(document.querySelectorAll('button:disabled')).some(button=>button.querySelector('[role="img"][aria-label*="unavailable"]'))`,
      ),
    );
    assert.equal(
      await evaluate(`!!document.querySelector('div.fixed.inset-0')`),
      false,
    );
    onCheck(
      "Edge: broken gallery images show the styled school-photo placeholder and cannot open the lightbox",
    );
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await navigate("/our-pride");
    assert.equal(
      await evaluate(`document.querySelectorAll('article.pride-card').length`),
      3,
    );
    assert.equal(
      await evaluate(
        `document.querySelectorAll('article.pride-card img').length`,
      ),
      0,
    );
    await screenshot("our-pride-listing-desktop.png");
    onCheck(
      "Edge: public listing renders the original three student cards with initials and no fake photographs",
    );
    const equals = cookie.indexOf("=");
    await send("Network.setCookie", {
      name: cookie.slice(0, equals),
      value: cookie.slice(equals + 1),
      url: base,
      httpOnly: true,
      sameSite: "Lax",
    });
    await navigate("/admin/dashboard");
    await evaluate(
      `Array.from(document.querySelectorAll('aside nav button')).find(b=>b.textContent==='Our Pride Management').click()`,
    );
    for (let i = 0; i < 60; i++) {
      if (await evaluate(`document.body.innerText.includes('3 records')`))
        break;
      await delay(250);
    }
    assert.ok(
      await evaluate(
        `document.body.innerText.includes('Card preview') && document.body.innerText.includes('Nyamme Liza Perme')`,
      ),
    );
    assert.equal(
      await evaluate(
        `!!document.querySelector('button[aria-label="Delete Nyamme Liza Perme"]')`,
      ),
      false,
    );
    await screenshot("our-pride-admin-desktop.png");
    await evaluate(
      `document.querySelector('button[aria-label="Edit Nyamme Liza Perme"]').click()`,
    );
    await delay(300);
    assert.equal(
      await evaluate(`document.querySelector('form input').value`),
      "Nyamme Liza Perme",
    );
    assert.ok(
      await evaluate(
        `document.querySelector('form').parentElement.querySelector('article').innerText.includes('2nd rank in APSBE')`,
      ),
    );
    onCheck(
      "Edge: authenticated admin manager loads, edits an original student and renders its live preview",
    );
    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await delay(300);
    assert.ok(
      await evaluate("document.documentElement.scrollWidth <= innerWidth"),
    );
    await screenshot("our-pride-admin-mobile.png");
    assert.deepEqual(errors, []);
    onCheck(
      "Edge: admin mobile layout has no horizontal overflow; no runtime exceptions during browser checks",
    );
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await evaluate(
      `Array.from(document.querySelectorAll('aside nav button')).find(button=>button.textContent==='CBSE documents').click()`,
    );
    for (let i = 0; i < 80; i++) {
      if (
        await evaluate(
          `document.body.innerText.includes('PDF Not Uploaded Yet')`,
        )
      )
        break;
      await delay(250);
    }
    assert.ok(
      await evaluate(
        `document.body.innerText.includes('Add New CBSE Information') && document.body.innerText.includes('PDF Not Uploaded Yet')`,
      ),
    );
    const beforeCbseUpload = await evaluate(
      `fetch('/api/cbse').then(response=>response.json()).then(items=>items.find(item=>item.title==='Fire Safety'))`,
    );
    assert.ok(beforeCbseUpload.available);
    const pdfFixture = path.join(
      os.tmpdir(),
      `dpvn-admin-cbse-${Date.now()}.pdf`,
    );
    try {
      await fs.writeFile(
        pdfFixture,
        Buffer.from("%PDF-1.4\nBrowser PDF fixture\n%%EOF"),
      );
      const cbseRoot = await send("DOM.getDocument");
      const pdfInput = await send("DOM.querySelector", {
        nodeId: cbseRoot.root.nodeId,
        selector: 'input[aria-label="Replace PDF for Fire Safety"]',
      });
      await send("DOM.setFileInputFiles", {
        nodeId: pdfInput.nodeId,
        files: [pdfFixture],
      });
      for (let i = 0; i < 80; i++) {
        if (
          await evaluate(
            `document.body.innerText.includes('CBSE document updated. Its public URL remains the same.')`,
          )
        )
          break;
        await delay(250);
      }
      const afterCbseUpload = await evaluate(
        `fetch('/api/cbse').then(response=>response.json()).then(items=>items.find(item=>item.title==='Fire Safety'))`,
      );
      assert.equal(afterCbseUpload.title, beforeCbseUpload.title);
      assert.equal(afterCbseUpload.url, beforeCbseUpload.url);
      assert.equal(
        await evaluate(
          `fetch(${JSON.stringify(afterCbseUpload.url)}).then(response=>response.status)`,
        ),
        200,
      );
      onCheck(
        "Edge: CBSE manager shows missing-PDF status and attaches a replacement PDF without changing the document title or stable URL",
      );
    } finally {
      await fs.unlink(pdfFixture).catch(() => {});
    }
    await evaluate(
      `Array.from(document.querySelectorAll('aside nav button')).find(button=>button.textContent==='Photo gallery').click()`,
    );
    for (let i = 0; i < 80; i++) {
      if (
        await evaluate(
          `!!document.querySelector('button[aria-label="Edit album ${galleryAlbumTitle}"]')`,
        )
      )
        break;
      await delay(250);
    }
    await evaluate(
      `document.querySelector('button[aria-label="Edit album ${galleryAlbumTitle}"]').click()`,
    );
    for (let i = 0; i < 80; i++) {
      if (
        await evaluate(
          `Array.from(document.querySelectorAll('h3')).some(item=>item.textContent===${JSON.stringify(galleryAlbumTitle)} && !!item.closest('div.rounded-2xl')?.querySelector('textarea'))`,
        )
      )
        break;
      await delay(250);
    }
    const updatedDescription = "Gallery description edited in browser";
    await evaluate(
      `(() => { const heading=Array.from(document.querySelectorAll('h3')).find(item=>item.textContent===${JSON.stringify(galleryAlbumTitle)}); const field=heading.closest('div.rounded-2xl').querySelector('textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,${JSON.stringify(updatedDescription)}); field.dispatchEvent(new Event('input',{bubbles:true})); })()`,
    );
    await evaluate(
      `Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Save album').click()`,
    );
    for (let i = 0; i < 80; i++) {
      if (
        await evaluate(
          `fetch('/api/gallery').then(response=>response.json()).then(data=>data.items.some(item=>item.title===${JSON.stringify(galleryAlbumTitle)} && item.description===${JSON.stringify(updatedDescription)}))`,
        )
      )
        break;
      await delay(250);
    }
    assert.equal(
      await evaluate(
        `fetch('/api/gallery').then(response=>response.json()).then(data=>data.items.some(item=>item.title===${JSON.stringify(galleryAlbumTitle)} && item.description===${JSON.stringify(updatedDescription)}))`,
      ),
      true,
    );
    onCheck(
      "Edge: administrator can edit and persist a gallery album description",
    );
    const { editorBrowserQA } = await import("./test-editor-browser.mjs");
    await editorBrowserQA({
      send,
      evaluate,
      screenshot,
      onCheck,
      temporaryFiles,
    });
    assert.deepEqual(errors, []);
    return browser;
  } finally {
    if (socket) socket.close();
    if (browser.exitCode === null) {
      const stopped = new Promise((resolve) => browser.once("exit", resolve));
      browser.kill();
      await Promise.race([stopped, delay(3000)]);
    }
    // Verify this generated profile is contained in the OS temporary directory.
    const parent = path.resolve(os.tmpdir());
    const resolved = path.resolve(profile);
    if (
      path.dirname(resolved) === parent &&
      path.basename(resolved).startsWith("dpvn-pride-browser-")
    )
      await fs.rm(resolved, { recursive: true, force: true }).catch(() => {});
  }
}
