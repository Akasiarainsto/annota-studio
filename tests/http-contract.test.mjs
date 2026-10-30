import test from 'node:test';
import assert from 'node:assert/strict';
import {readJson,readBytes,requireObject} from '../server/http.js';

const request=body=>new Request('https://fixture.invalid',{method:'POST',body});
test('JSON request boundary rejects syntax errors and non-object roots with a client error',async()=>{
  for(const body of ['{','null','[]','42'])await assert.rejects(readJson(request(body)),error=>error.status===400);
  assert.deepEqual(await readJson(request('{"task":{}}')),{task:{}});
});
test('nested task contract rejects null, arrays and scalar payloads without a server exception',()=>{
  for(const payload of [null,undefined,[],1,'task'])assert.throws(()=>requireObject(payload,'task'),error=>error.status===400&&/task/.test(error.message));
});
test('streamed request size is enforced even without a content length',async()=>{
  await assert.rejects(readBytes(request('12345'),4),error=>error.status===413);
});
