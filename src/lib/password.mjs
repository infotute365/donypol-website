import crypto from 'node:crypto';
const PARAMS = { N: 16384, r: 8, p: 1 };
export function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 16) throw new Error('Admin password must be at least 16 characters');
  const salt = crypto.randomBytes(24).toString('hex');
  const digest = crypto.scryptSync(password, salt, 64, PARAMS).toString('hex');
  return `scrypt$${salt}$${digest}`;
}
export function comparePassword(password, stored) {
  try {
    const [algorithm, salt, hex] = stored.split('$');
    if (algorithm !== 'scrypt' || !/^[a-f0-9]{48}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hex)) return false;
    const actual = crypto.scryptSync(String(password), salt, 64, PARAMS);
    const expected = Buffer.from(hex, 'hex');
    return crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}
