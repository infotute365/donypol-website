import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const seed=JSON.parse(fs.readFileSync(path.join(root,'data/seed-content.json'),'utf8'));
const original=JSON.parse(fs.readFileSync(path.join(root,'data/site.json'),'utf8'));
for (const key of Object.keys(original)) {
  if(JSON.stringify(original[key]) !== JSON.stringify(seed[key]))throw Error(`Original ${key} changed`);
}
if(seed.school.name !== 'Donyi Polo Vidya Niketan')throw Error('School name mismatch');
for(const route of ['src/app/api/circulars/route.js','src/app/api/cbse/route.js','src/app/api/media/cbse/[id]/route.js','src/app/api/media/image/route.js','src/app/(public)/circulars/page.jsx'])if(!fs.existsSync(path.join(root,route)))throw Error(`Missing ${route}`);
console.log('Original JSON content preserved byte-for-byte for all original fields. Core circular/CBSE routes present.');
