const loopback = (hostname) => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

export function sameOriginAllowed(request, configuredOrigin, mode = 'production') {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;
  try {
    const source = new URL(origin);
    const target = new URL(request.url);
    const configured = new URL(configuredOrigin || target.origin);
    if (!['http:', 'https:'].includes(source.protocol) || source.origin !== origin) return false;
    if (source.origin === configured.origin) return true;
    // Local development may be opened using either loopback hostname. Still
    // require the browser's exact origin to match this request's target, port
    // and protocol; production retains the configured origin exclusively.
    // Next's dev server can normalize request.url to localhost even when the
    // browser uses 127.0.0.1. Host still identifies the browser's actual target.
    const localTargetMatches = source.origin === target.origin ||
      (loopback(target.hostname) && request.headers.get('host') === source.host && target.port === source.port && target.protocol === source.protocol);
    return mode === 'development' && loopback(source.hostname) && loopback(configured.hostname) &&
      localTargetMatches && source.port === configured.port && source.protocol === configured.protocol;
  } catch { return false; }
}
