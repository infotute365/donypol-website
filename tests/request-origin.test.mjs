import test from 'node:test';
import assert from 'node:assert/strict';
import { sameOriginAllowed } from '../src/lib/request-origin.mjs';

function request(target, origin, fetchSite = 'same-origin') {
  const headers = new Headers({ 'sec-fetch-site': fetchSite });
  if (origin !== undefined) headers.set('origin', origin);
  return { url: target + '/api/auth/login', headers };
}
test('development accepts same-origin requests using loopback aliases on the configured port', () => {
  for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000']) {
    assert.equal(sameOriginAllowed(request(origin, origin), 'http://localhost:3000', 'development'), true);
  }
  const normalized = request('http://localhost:3000', 'http://127.0.0.1:3000');
  normalized.headers.set('host', '127.0.0.1:3000');
  assert.equal(sameOriginAllowed(normalized, 'http://localhost:3000', 'development'), true);
});
test('development alias exception rejects mismatched targets, ports, protocols, remote hosts and malformed origins', () => {
  for (const origin of ['http://127.0.0.1:3001', 'https://127.0.0.1:3000', 'http://localhost.evil.example:3000', 'http://192.168.1.2:3000', 'null', undefined, 'http://127.0.0.1:3000/extra']) {
    assert.equal(sameOriginAllowed(request('http://127.0.0.1:3000', origin), 'http://localhost:3000', 'development'), false);
  }
  assert.equal(sameOriginAllowed(request('http://127.0.0.1:3000', 'http://[::1]:3000'), 'http://localhost:3000', 'development'), false);
  assert.equal(sameOriginAllowed(request('http://127.0.0.1:3000', 'http://127.0.0.1:3000', 'cross-site'), 'http://localhost:3000', 'development'), false);
});
test('production only accepts the configured origin and never enables loopback aliases', () => {
  assert.equal(sameOriginAllowed(request('http://127.0.0.1:3000', 'http://127.0.0.1:3000'), 'http://localhost:3000', 'production'), false);
  assert.equal(sameOriginAllowed(request('https://school.example', 'https://school.example'), 'https://school.example/', 'production'), true);
  assert.equal(sameOriginAllowed(request('https://school.example', 'https://evil.example'), 'https://school.example', 'production'), false);
  assert.equal(sameOriginAllowed(request('https://school.example', undefined), 'https://school.example', 'production'), false);
});
