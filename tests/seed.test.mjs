import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { formatSeedError } from '../scripts/seed-config.mjs';

const configUrl = new URL('../scripts/seed-config.mjs', import.meta.url).href;
const seedFile = fileURLToPath(new URL('../scripts/seed.mjs', import.meta.url));
const keys = ['MONGODB_URI', 'ADMIN_INITIAL_USERNAME', 'ADMIN_INITIAL_PASSWORD'];

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dpvn-seed-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function runNode(args, cwd, overrides = {}) {
  const env = { ...process.env };
  for (const key of keys) delete env[key];
  return spawnSync(process.execPath, args, { cwd, env: { ...env, ...overrides }, encoding: 'utf8', timeout: 10000, windowsHide: true });
}

function loadConfig(root, overrides = {}) {
  const script = `import { loadSeedEnvironment } from ${JSON.stringify(configUrl)};
    loadSeedEnvironment(process.argv[1]);
    console.log(JSON.stringify(${JSON.stringify(keys)}.map(key => process.env[key] ?? null)));`;
  return runNode(['--input-type=module', '-e', script, root], root, overrides);
}

test('seed loads .env when .env.local is absent, including quoted passwords', (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, '.env'), 'MONGODB_URI=mongodb://127.0.0.1/test\nADMIN_INITIAL_USERNAME=seed_admin\nADMIN_INITIAL_PASSWORD="a password with # characters"\n');
  const result = loadConfig(root);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), ['mongodb://127.0.0.1/test', 'seed_admin', 'a password with # characters']);
});

test('seed preserves shell variables and gives .env.local precedence over .env', (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, '.env.local'), 'MONGODB_URI=mongodb://local/test\nADMIN_INITIAL_USERNAME=local_admin\n');
  fs.writeFileSync(path.join(root, '.env'), 'MONGODB_URI=mongodb://fallback/test\nADMIN_INITIAL_USERNAME=fallback_admin\nADMIN_INITIAL_PASSWORD=fallback-password-1234\n');
  const result = loadConfig(root, { MONGODB_URI: 'mongodb://shell/test' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), ['mongodb://shell/test', 'local_admin', 'fallback-password-1234']);
});

test('seed accepts an exported environment without either env file', (t) => {
  const root = fixture(t);
  const values = { MONGODB_URI: 'mongodb://shell/test', ADMIN_INITIAL_USERNAME: 'shell_admin', ADMIN_INITIAL_PASSWORD: 'shell-password-1234' };
  const result = loadConfig(root, values);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), keys.map(key => values[key]));
});

test('seed does not silently ignore env file errors other than missing files', (t) => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, '.env.local'));
  const result = loadConfig(root);
  assert.notEqual(result.status, 0);
});

test('seed errors retain useful diagnostics and redact connection strings and secrets', () => {
  const env = { MONGODB_URI: 'mongodb://db_user:db_secret@localhost/test', ADMIN_INITIAL_PASSWORD: 'admin-secret-1234!', JWT_SECRET: 'jwt-secret-123456789' };
  const error = new Error(`connect ECONNREFUSED ${env.MONGODB_URI} mongodb+srv://other:secret@cluster/test password ${env.ADMIN_INITIAL_PASSWORD} encoded ${encodeURIComponent(env.ADMIN_INITIAL_PASSWORD)} jwt ${env.JWT_SECRET}`);
  error.code = 'ECONNREFUSED';
  const message = formatSeedError(error, env);
  assert.match(message, /ECONNREFUSED/);
  for (const secret of [...Object.values(env), 'db_secret', 'other:secret', encodeURIComponent(env.ADMIN_INITIAL_PASSWORD)]) assert.equal(message.includes(secret), false);
});

test('seed entry point reports missing variable names and exits unsuccessfully', (t) => {
  const root = fixture(t);
  const preload = 'data:text/javascript,' + encodeURIComponent('process.loadEnvFile = () => {};');
  const result = runNode(['--import', preload, seedFile], root);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /validating configuration/);
  assert.match(result.stderr, /Missing MONGODB_URI, ADMIN_INITIAL_USERNAME, ADMIN_INITIAL_PASSWORD/);
});

test('seed loads configuration before use and finds its source when invoked outside the project', (t) => {
  const root = fixture(t);
  const uri = 'mongodb://db_user:db_secret@127.0.0.1:1/seed_test';
  const mongooseUrl = new URL('../node_modules/mongoose/index.js', import.meta.url).href;
  const preload = 'data:text/javascript,' + encodeURIComponent(`
    import mongoose from ${JSON.stringify(mongooseUrl)};
    process.loadEnvFile = () => {
      process.env.MONGODB_URI = ${JSON.stringify(uri)};
      process.env.ADMIN_INITIAL_USERNAME = 'seed_admin';
      process.env.ADMIN_INITIAL_PASSWORD = 'seed-password-1234';
    };
    mongoose.connect = async (uri) => { throw new Error('Simulated connection failure: ' + uri); };
  `);
  const result = runNode(['--import', preload, seedFile], root);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /connecting to MongoDB: Error: Simulated connection failure/);
  assert.equal(result.stderr.includes('db_secret'), false);
});
