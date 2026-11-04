# Website editor and homepage background

Open [Admin dashboard](http://localhost:3000/admin/dashboard) and select **Website editor**. Refresh the dashboard with Ctrl+Shift+R if it was open while the update was installed.

## Replace the homepage background

1. Choose **Home page** in **Page or section to edit**.
2. In **Homepage background image**, select **Replace homepage background**.
3. Choose a JPEG, PNG, WebP or GIF up to 8 MB.
4. Check the private website preview. Select desktop, tablet or mobile sizing, or use the external-link icon to open the full preview in a new tab.
5. Select **Publish website changes** when satisfied.

The banner now has its own setting, so replacing it does not replace the shared school gate/welcome photo. Existing saved content is retained. Until a separate banner is saved, older records use their currently selected school gate image as the banner fallback.

## Know what you are editing

The editor has a page/section selector, an **Editing** label with the public route, and a field breadcrumb when a field receives focus. Image controls show the current filename and a thumbnail. Choose **Shared school images** to edit the existing shared images, while the dedicated banner control is on **Home page**.

The preview updates after a short typing pause. It uses the actual public page components, including their navigation, layout, typography and current published circulars/gallery/achievements. All nine public pages can be previewed. Content edited in this editor remains private until publishing; this preview does not stage changes made through the separate gallery, circulars, CBSE or Our Pride managers.

**View published page** opens the current public page. The external-link icon inside **Website preview** opens the unpublished draft. **Discard changes** restores the last version published from the editor after confirmation.

## Privacy and storage

Preview snapshots are scoped to the signed-in administrator and individual editor session. They expire after 30 minutes and have a MongoDB TTL cleanup index. Server sequence checks stop a delayed older request from overwriting a newer preview. Snapshots do not update public content or increment its revision. The preview endpoint validates content, bounds request size and limits refresh frequency. Preview pages require an active administrator session.

Only `/admin/preview` permits embedding by this same website. The admin dashboard and public pages retain their existing frame protection, using Next.js's documented [header override behavior](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers).

Uploads retain the existing filesystem storage directory and type/signature checks. New editor image URLs are served through `/api/media/image?file=...`, so they work immediately on the production server without a restart. Images are only linked into the public site when the content is published. Discarded uploads are retained rather than automatically deleting a file that another field or saved page may still reference.

## Source changes

- Editor UI: `src/components/admin/WebsiteEditor.jsx`, `Dashboard.jsx`.
- Shared editor metadata/defaults: `src/lib/site-editor.mjs`; validation and persistence: `src/lib/validate.js`, `db.js`.
- Private preview: `src/app/api/content/preview/route.js`, `src/app/admin/preview/[[...slug]]/page.jsx`, `src/components/admin/PreviewBridge.jsx`, and `PreviewDraft` in `src/lib/models.js`.
- Bounded request reading and throttling: `src/lib/request-body.mjs`, `admin-rate-limit.js`.
- Immediate image delivery: `src/app/api/media/image/route.js`.
- Public page components accept authenticated preview data; the homepage reads the new optional `pages.images.heroBackground`. Public requests continue reading only published content. Navbar recognizes the preview route when highlighting navigation.
- Frame policy exception: `next.config.mjs`.
- Checks: `tests/site-editor.test.mjs`, `tests/security-headers.test.mjs`, `scripts/test-editor-browser.mjs`, and the existing integration/browser runners.

No MongoDB connection settings or original content JSON were changed. Tests and test uploads ran against a disposable database; they did not publish fixture content to the school database. Existing administrator edits were retained.

## Actual verification

- `npm test`: **25 passed**, 0 failed.
- `npm run verify`: passed; original source content fields preserved.
- `npm run build` with `NEXT_DIST_DIR=.next-build-check`: passed.
- `npm run test:browser` against that build: **34 integration/browser check groups passed**. These include authenticated uploads, immediate image delivery, path safety, private preview access and ownership, expiry, stale-request ordering, all nine public preview routes, unsaved-content isolation, banner-only publication, real editor text changes, page switching, screen-size controls, mobile layout, image upload through the UI, publishing and discarding.
- The development homepage and login page still respond successfully at localhost:3000.

Existing Node module-type detection warnings remain in standalone tests; they do not fail verification. No production deployment was performed.

Screenshots: [Desktop editor](artifacts/website-editor-desktop.png), [unsaved draft preview](artifacts/website-editor-draft-preview.png), [mobile editor](artifacts/website-editor-mobile.png).
