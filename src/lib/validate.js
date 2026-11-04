import { withSiteDefaults } from './site-editor.mjs';
export const errorJson = (message, status = 400) => Response.json({ error: message }, { status });
export function checkSiteInput(value, seed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Content must be an object';
  if (JSON.stringify(value).length > 600000) return 'Content is too large';
  const walk = (node, baseline, path = '') => {
    if (typeof baseline === 'string') {
      if (typeof node !== 'string' || node.length > 15000) return `Invalid text at ${path}`;
      if (/^(https?:\/\/|\/)/.test(baseline) && node) {
        if (!(node.startsWith('/') && !node.startsWith('//') && !node.includes('\\')) &&
            !/^https:\/\/[a-z0-9.-]+(?:[:][0-9]+)?(?:[/?#]|$)/i.test(node) &&
            !/^mailto:[^\s]+@[^\s]+$|^tel:[+0-9 -]+$/.test(node)) return `Unsafe URL at ${path}`;
      }
      return null;
    }
    if (Array.isArray(baseline)) {
      if (!Array.isArray(node) || node.length > 200) return `Invalid list ${path}`;
      for (let i = 0; i < node.length; i++) {
        const exemplar = baseline[Math.min(i, baseline.length - 1)];
        if (exemplar === undefined) return `Unexpected item at ${path}`;
        const problem = walk(node[i], exemplar, `${path}[${i}]`); if (problem) return problem;
      }
      return null;
    }
    if (baseline && typeof baseline === 'object') {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return `Invalid group ${path}`;
      if (Object.keys(node).some((key) => !(key in baseline) || key.startsWith('$') || key.includes('.'))) return `Unexpected field at ${path}`;
      for (const key of Object.keys(baseline)) {
        if (!(key in node)) return `Missing field ${path}.${key}`;
        const problem = walk(node[key], baseline[key], `${path}.${key}`); if (problem) return problem;
      }
      return null;
    }
    return JSON.stringify(node) === JSON.stringify(baseline) ? null : `Invalid value ${path}`;
  };
  return walk(withSiteDefaults(value), withSiteDefaults(seed));
}
