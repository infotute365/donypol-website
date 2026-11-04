import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../next.config.mjs';

test('Next dev runtime is allowed while production keeps eval and external WebSockets disabled', async () => {
  const original = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'development';
    const development = (await config.headers())[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
    assert.match(development, /script-src 'self' 'unsafe-inline' 'unsafe-eval';/);
    assert.match(development, /connect-src 'self' ws:\/\/localhost:\*/);
    process.env.NODE_ENV = 'production';
    const production = (await config.headers())[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
    assert.doesNotMatch(production, /unsafe-eval|ws:\/\//);
    assert.match(production, /form-action 'self';/);
    assert.match(production, /frame-ancestors 'none';/);
    const previewRule = (await config.headers()).find((rule) => rule.source === '/admin/preview/:path*');
    assert.equal(previewRule.headers.find((header) => header.key === 'X-Frame-Options').value, 'SAMEORIGIN');
    assert.match(previewRule.headers.find((header) => header.key === 'Content-Security-Policy').value, /frame-ancestors 'self';/);
    assert.match(production, /frame-src 'self' https:\/\/www.google.com/);
  } finally {
    if (original === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original;
  }
});
