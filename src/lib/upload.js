import path from 'node:path';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';

export const UPLOAD_DIR = path.join(process.cwd(), 'public', 'upload');
export const PUBLIC_UPLOAD_PREFIX = '/upload/';
export async function ensureUploadDir() { await fs.mkdir(UPLOAD_DIR, { recursive: true }); }
export function safeOriginalName(name) { return path.basename(String(name || 'upload')).replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 100) || 'upload'; }
export function storedFileName(name, ext) { return `${path.basename(safeOriginalName(name), path.extname(name)).slice(0, 50)}-${crypto.randomBytes(16).toString('hex')}.${ext}`; }
function sniff(buffer, type) {
  if (type === 'pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-' ? ['pdf', 'application/pdf'] : null;
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return ['jpg', 'image/jpeg'];
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return ['png', 'image/png'];
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return ['webp', 'image/webp'];
  if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString())) return ['gif', 'image/gif'];
  return null;
}
export function validateImage(file) { return file && file.size > 0 && file.size <= 8 * 1024 * 1024 && ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type); }
export function validatePdf(file) { return file && file.size > 0 && file.size <= 20 * 1024 * 1024 && file.type === 'application/pdf'; }
export async function saveFile(file, kind = 'image') {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('Upload required');
  if (!(kind === 'pdf' ? validatePdf(file) : validateImage(file))) throw new Error('Invalid file type or size');
  const buffer = Buffer.from(await file.arrayBuffer());
  const info = sniff(buffer, kind);
  if (!info || info[1] !== file.type || buffer.length !== file.size) throw new Error('The file content does not match the allowed format');
  const fileName = storedFileName(file.name, info[0]);
  await ensureUploadDir();
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer, { flag: 'wx', mode: 0o644 });
  return { originalName: safeOriginalName(file.name), fileName, url: `${PUBLIC_UPLOAD_PREFIX}${encodeURIComponent(fileName)}`, mimeType: info[1] };
}
export async function deleteFile(name) {
  if (!name) return;
  try { await fs.unlink(path.join(UPLOAD_DIR, path.basename(name))); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
}
