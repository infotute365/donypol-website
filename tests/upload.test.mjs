import test from 'node:test';
import assert from 'node:assert/strict';
import {File} from 'node:buffer';
import {saveFile,deleteFile,validateImage,validatePdf} from '../src/lib/upload.js';
test('PDF and image input size/MIME gates',()=>{
  assert.equal(validatePdf(new File(['fake'],'x.pdf',{type:'text/plain'})),false);
  assert.equal(validateImage(new File(['<svg/>'],'x.svg',{type:'image/svg+xml'})),false);
  assert.equal(validatePdf(new File(['%PDF-1.7'],'x.pdf',{type:'application/pdf'})),true);
});
test('uploaded file bytes are validated, renamed, and removable',async()=>{
  await assert.rejects(saveFile(new File(['not a real pdf'],'fake.pdf',{type:'application/pdf'}),'pdf'),/does not match/);
  const f=new File([Buffer.from('%PDF-1.7\n1 0 obj\n')], '../../test.pdf',{type:'application/pdf'});
  const saved=await saveFile(f,'pdf');
  assert.match(saved.fileName,/^[a-zA-Z0-9_-]+-[a-f0-9]{32}\.pdf$/);
  assert.match(saved.url,/^\/upload\//);
  await deleteFile(saved.fileName);
});

test('mismatched image MIME and signatures are rejected', async () => {
  const png = Buffer.from([137,80,78,71,13,10,26,10]);
  await assert.rejects(saveFile(new File([png], 'fake.jpg', { type: 'image/jpeg' })), /does not match/);
  await assert.rejects(saveFile(new File(['<script>bad</script>'], 'fake.png', { type: 'image/png' })), /does not match/);
  assert.equal(validateImage({ type: 'image/png', size: 8 * 1024 * 1024 + 1 }), false);
});
