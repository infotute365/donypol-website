# Donyi Polo Vidya Niketan — Next.js school website

Updated from the uploaded school ZIP. The original school text, school identity, gallery photo links, and CBSE document titles/links have been preserved in `data/site.json` and seeded into `data/seed-content.json` without changing their original fields.

## Included

- New responsive heritage-inspired public UI, maroon/gold/cream glassmorphism and restrained claymorphism, using **original school image URLs** (no Don Bosco content).
- MongoDB connection at `src/server/config/database.js`, shared by all server routes.
- Admin login `/admin/login` with scrypt password hashing, signed JWT in HTTP-only same-site cookies, session-version invalidation, login throttling, same-origin checks, audit entries, and protected dashboard.
- `/admin/dashboard` sections: overview, structured **all-page text and image editor**, dynamic circulars panel, CBSE PDFs, gallery.
- Public circulars panel on homepage and `/circulars` page. Add, edit, pin, attach PDF, and delete from admin.
- Permanent CBSE document URLs `/api/media/cbse/<document-id>` that remain the same when the underlying PDF is replaced. Old seeded PDFs redirect to original school-hosted URLs until replaced.
- Gallery event CRUD and dedicated image uploads, with image/PDF content-signature validation and size limits.
- Editing public content does not silently overwrite school source material; every initial edit is explicit and saved in MongoDB.

## Start on your computer

Requires **Node.js 20.19.0 or newer** and a working **MongoDB server**. This minimum comes from [Mongoose 9](https://mongoosejs.com/docs/migrating_to_9.html#nodejs-version-support).

```bash
npm install
npm run seed
npm run dev
```

Open `http://localhost:3000`. Admin login: `http://localhost:3000/admin/login`. The local handover file `ADMIN_LOGIN_LOCAL.txt` contains the **generated** development username/password, and `.env.local` contains a unique JWT secret. Do not upload either of these files publicly or commit them.

The development server also supports `http://127.0.0.1:3000/admin/login` on the same configured port. This loopback alias is allowed only in development; production requires the configured `APP_ORIGIN`. The CSP permits Next.js debugging scripts and local hot-reload WebSockets only in development. If a previously opened login page appears unresponsive after an update, reload it with Ctrl+Shift+R.

To verify a production build while the development server is running, use a separate output directory in PowerShell: `$env:NEXT_DIST_DIR='.next-build-check'; npm run build`. Set the same variable when running `npm run test:browser` against that build. This avoids overwriting the development server's `.next` output.

`npm run seed` is idempotent. It inserts baseline content once and will **never** overwrite admin-edited content. To intentionally replace a provisioned account password, set `ADMIN_INITIAL_PASSWORD` to a new strong value and run `npm run seed -- --reset-password`. The command invalidates earlier login sessions.

## Production on Hetzner VPS

1. Install Node.js 20.19.0 or newer, MongoDB (or a protected managed MongoDB), and Nginx as a TLS-terminating reverse proxy. Configure Nginx to forward the real `Host` and `X-Real-IP` headers only from its trusted proxy. Do not expose MongoDB port 27017 publicly.
2. Set **new** production values for `MONGODB_URI`, `JWT_SECRET` (48+ random characters), `APP_ORIGIN=https://your-domain`, and temporary `ADMIN_INITIAL_USERNAME` / `ADMIN_INITIAL_PASSWORD`. Never reuse the local values from this handover.
3. Run `npm install`, then **seed once**, then `npm run build`, and run `npm start` behind HTTPS. If using env files, provide them securely to the deployment process. Avoid including secrets in client-side `NEXT_PUBLIC_*` variables.
4. After provisioning, clear the `ADMIN_INITIAL_PASSWORD` value and remove the local credentials handover file. Store the production credentials in a password manager.
5. Persist and back up **both MongoDB and `public/upload/`** across deployments. The upload directory is a stateful VPS volume; serverless ephemeral storage is unsupported for uploads. Configure file-size limits in Nginx too (e.g. `client_max_body_size 25m;`).
6. Smoke test login/logout, failed-login throttling, admin authorization, image upload, each gallery operation, circular publishing, CBSE PDF replacement, all original photos, and backup restoration on the actual production domain. Enable HTTPS, monitoring, database backups and security patch updates.

### Troubleshooting `npm run seed` on the VPS

The command reads `.env.local`, then `.env` from the project directory. Variables already exported in the shell take precedence over both files; `.env.local` takes precedence over `.env`. Neither file is required if the shell already supplies the configuration. Variables configured only for a running PM2/systemd service are not automatically available to a separate SSH shell. The seed command requires `MONGODB_URI`, `ADMIN_INITIAL_USERNAME` (4–64 letters, digits, dots, dashes or underscores) and `ADMIN_INITIAL_PASSWORD` (at least 16 characters).

Run `node --version` and `npm run seed` from the deployed project directory. Failures now report the operation and underlying error while redacting MongoDB connection strings and configured secrets:

- `Missing ...`: supply the named variables in the command's environment or one of the files above.
- `ECONNREFUSED` / server selection timeout: check that MongoDB is running and reachable from the VPS at the configured host and port.
- `Authentication failed`: check the database user's credentials and `authSource` in `MONGODB_URI`.
- `Another administrator exists`: automatic creation of a second administrator is disabled. Use the existing administrator's username. Password changes require the explicit `--reset-password` option described above.

## Verification

The **Website editor** now includes a separate homepage background replacement control, page/field labels, current image filenames, and an authenticated live draft preview with desktop/tablet/mobile modes. Changes are visible publicly only after publishing. See [WEBSITE_EDITOR.md](WEBSITE_EDITOR.md) for the steps, privacy behavior, screenshots and verification results.

Our Pride is managed in **Admin dashboard → Our Pride Management**. Add/edit names, achievements, award titles, optional descriptions/classes/years and optional photos. Preview the card, then save hidden or published. Published records appear newest first; the homepage shows three, and `/our-pride?page=1` shows nine per page. Use this dedicated manager instead of the former generic achievers editor.

The original three students are migrated idempotently by `npm run seed` or the first Our Pride read. Existing school data is preserved. Publication timestamps for imported records represent migration time; no historical achievement years are inferred. Completion markers prevent deleted achievements from returning on a later seed.

`npm run test:integration` launches the production build on port 3100 against a unique disposable test database, checks real authenticated CRUD, uploads and public queries, then removes its test database/files. Run `npm run build` first. `npm run test:browser` also uses installed headless Microsoft Edge (override `EDGE_PATH` when necessary), checks six responsive widths and writes screenshots to `artifacts/`.

Optional footer attribution reads `DEVELOPER_CREDIT_NAME` and `DEVELOPER_CREDIT_URL` from the server environment. Set these to the actual approved developer details; no attribution name is invented. The footer includes an Admin Login link.

See [IMPLEMENTATION.md](IMPLEMENTATION.md) for the model, endpoints, changed files, screenshots and actual validation results.

Run `npm run verify`, `npm test`, and `npm run build`. Offline tests cover original source content preservation and password-hash properties. The full MongoDB integration and HTTPS security testing must be completed against your deployment; passing a build alone does **not** establish a penetration-tested, zero-vulnerability production system.

## Notes

- Do not change the original school photo URLs without permission. Their current rendering depends on the source domain staying online; to fully self-host, migrate and retain the same original assets in persistent storage.
- Existing CBSE links are imported as remote references. They will continue redirecting to the source domain unless an admin uploads replacement PDFs.
- Uploads are published under `public/upload`. Never allow executable file types; the API accepts only images (JPEG, PNG, WebP, GIF) and PDFs with matching file signatures.
- The content editor saves edits with optimistic revision checks to avoid overwriting a simultaneous change.
