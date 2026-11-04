import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const paths=['src/app/api/cbse/route.js','src/app/api/cbse/[id]/route.js','src/app/api/gallery/route.js','src/app/api/gallery/[id]/route.js','src/app/api/circulars/route.js','src/app/api/circulars/[id]/route.js','src/app/api/media/image/route.js','src/app/api/content/route.js'];
for(const path of paths)test(`mutating route ${path} requires authenticated admin and checks origin`,()=>{
  const s=fs.readFileSync(path,'utf8');assert.match(s,/sameOrigin\(/);assert.match(s,/(getAdmin|isAdmin)\(/);assert.match(s,/(POST|PUT|DELETE)\(/);
});
