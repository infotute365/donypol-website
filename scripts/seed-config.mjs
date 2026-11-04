import path from 'node:path';

export function loadSeedEnvironment(root) {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 20 || (major === 20 && minor < 19)) {
    throw new Error(`Node.js 20.19.0 or newer is required by Mongoose. Current version: ${process.version}.`);
  }
  // Existing shell variables win; .env.local takes precedence over .env.
  // Missing files are fine when the deployment exports its configuration.
  for (const file of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(path.join(root, file));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

export function formatSeedError(error, env = process.env) {
  let message = `${error?.name || 'Error'}${error?.code ? ` (${error.code})` : ''}: ${error?.message || String(error)}`;
  message = message.replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[redacted MongoDB URI]');
  const secrets = [env.MONGODB_URI, env.ADMIN_INITIAL_PASSWORD, env.JWT_SECRET].filter(Boolean);
  for (const secret of secrets.flatMap((value) => [value, encodeURIComponent(value)]).sort((a, b) => b.length - a.length)) {
    message = message.split(secret).join('[redacted]');
  }
  return message;
}
