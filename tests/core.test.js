import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateDocument} from '../public/src/core/validation.js';
import {inspectJsonText} from '../public/src/core/json-validation.js';
import {calculateKappa,resolveReviewStatus} from '../public/src/core/quality.js';
import {splitSegment,mergeSegment} from '../public/src/core/segments.js';
import {calculateCer} from '../public/src/core/cer.js';
import {stratifiedSample} from '../public/src/core/sampling.js';
import {readWavMetadata} from '../public/src/core/wav-metadata.js';

function audioDocument(){const doc=JSON.parse(readFileSync(new URL('../docs/audio_reference_draft.json',import.meta.url)));doc.media.url='/assets/audio/D11_766.wav';delete doc.media.file;doc.segments.forEach(segment=>{segment.quality='clear';segment.boundary_status='confirmed';});return doc;}
test('audio rules distinguish legal formatting, boundary confirmation, time and speaker errors',()=>{
  const doc=audioDocument();assert.deepEqual(validateDocument(doc,{submission:true}),[]);
  doc.segments[0].transcript=doc.segments[0].transcript.replace('宁夏','宁下');assert.deepEqual(validateDocument(doc),[],'a format validator must not claim semantic judgment');
  doc.segments[2].end_s=13.5;assert.ok(validateDocument(doc).some(error=>error.code==='E_TIME_OUT_OF_RANGE'&&error.path==='/segments/2/end_s'));
  doc.segments[0].speaker_id='unknown';assert.ok(validateDocument(doc).some(error=>error.code==='E_SPEAKER_REF'));
  doc.segments[1].boundary_status='pending_listen';assert.ok(validateDocument(doc,{submission:true}).some(error=>error.code==='E_CONFIRM_BOUNDARY'));
});
test('different speakers may explicitly overlap; same-speaker overlap is rejected',()=>{
  const doc=audioDocument();doc.speakers.push({id:'S2'});doc.segments[1].start_s=3;doc.segments[1].speaker_id='S2';doc.segments[0].overlap=true;doc.segments[1].overlap=true;
  assert.equal(validateDocument(doc).filter(error=>error.code==='E_OVERLAP').length,0);
  doc.segments[1].speaker_id='S1';assert.ok(validateDocument(doc).some(error=>error.code==='E_OVERLAP'));
});
test('image rules use pixels, captions and tags instead of audio fields',()=>{
  const doc={schema_version:'1.0',modality:'image',task_id:'I',media:{id:'img',url:'/image.jpg',width:1920,height:1440},caption:'人物与摊位',scene:'market',lighting:'daylight',tags:['person'],content_confirmed:true,boxes:[{id:'B1',x:0,y:0,width:200,height:500,label:'person',occluded:false}]};
  assert.deepEqual(validateDocument(doc,{submission:true}),[]);doc.boxes[0].x=1900;assert.ok(validateDocument(doc).some(error=>error.code==='E_BOX_BOUNDS'));
  doc.tags=['speaker'];assert.ok(validateDocument(doc).some(error=>error.code==='E_IMAGE_TAGS'));
});
test('video evaluation shared range uses the shorter original, and rejects malformed candidates safely',()=>{
  const doc={modality:'video_evaluation',input_ref:'same-prompt',candidates:[{media_id:'a',duration_s:8},{media_id:'b',duration_s:10}],comparison:{start_s:0,end_s:8},ratings:[{score_a:2,score_b:null,reason_a:'具体片段不符合'}]};
  assert.deepEqual(validateDocument(doc),[]);doc.comparison.end_s=9;assert.ok(validateDocument(doc).some(error=>error.code==='E_SHARED_RANGE_OUT_OF_BOUNDS'));
  doc.candidates[0]=null;assert.ok(validateDocument(doc).length);
});
test('JSON/JSONL detects duplicate keys, finite-number overflow and duplicate task IDs with locations',()=>{
  const doc=audioDocument();const json=JSON.stringify(doc,null,2);assert.equal(inspectJsonText(json).valid,true);
  const duplicate=json.replace('"schema_version": "1.0"','"schema_version": "1.0", "schema_version": "1.0"');assert.ok(inspectJsonText(duplicate).issues.some(error=>error.code==='E_JSON_DUPLICATE-KEY'&&error.line===2));
  const overflow=json.replace('12.958','1e999');assert.ok(inspectJsonText(overflow).issues.some(error=>error.code==='E_JSON_NUMBER'));
  const jsonl=JSON.stringify(doc)+'\n'+JSON.stringify(doc);assert.ok(inspectJsonText(jsonl).issues.some(error=>error.code==='E_DUPLICATE_TASK_ID'&&error.line===2));
  assert.equal(inspectJsonText('null').valid,false);assert.equal(inspectJsonText('{broken').valid,false);
});
test('split keeps original text once and creates an empty tail; merge requires compatible speaker',()=>{
  const doc=audioDocument(),original=doc.segments[0].transcript;const split=splitSegment(doc,{id:'S01',time:2});
  assert.equal(split.segments[0].transcript,original);assert.equal(split.segments[1].transcript,'');assert.equal(split.segments[0].boundary_status,'pending_listen');
  const merged=mergeSegment(split,'S01');assert.equal(merged.segments[0].transcript,original);assert.equal(merged.segments.length,3);
  split.segments[1].speaker_id='S2';assert.throws(()=>mergeSegment(split,'S01'));
});
test('independent review and Kappa do not turn a single opinion or degenerate labels into acceptance',()=>{
  assert.equal(resolveReviewStatus([{decision:'pass'}]),'pending');assert.equal(resolveReviewStatus([{decision:'fail'},{decision:'fail'}]),'returned');assert.equal(resolveReviewStatus([{decision:'pass'},{decision:'fail'}]),'disputed');
  assert.equal(calculateKappa([]).value,null);assert.equal(calculateKappa([['pass','pass']]).value,null);
  const pairs=[...Array(7).fill(['pass','pass']),['pass','fail'],['fail','pass'],['fail','pass'],['fail','fail'],['fail','fail']];assert.ok(Math.abs(calculateKappa(pairs).value-.4)<1e-12);
});
test('CER remains based on unmodified machine draft; sample plan is reproducible and stratified',()=>{
  const doc=audioDocument();const original=JSON.parse(readFileSync(new URL('../docs/audio_model_original.json',import.meta.url))).text;
  const result=calculateCer(doc.segments.map(item=>item.transcript).join(''),original);assert.equal(result.s,2);assert.equal(result.n,43);assert.equal(result.cer,2/43);
  const tasks=['audio','video','image'].flatMap(modality=>Array.from({length:4},(_,index)=>({id:modality+index,modality,difficulty:'常规',assignee:'annotator',version:1,round:1})));
  const first=stratifiedSample(tasks,{seed:'same',rate:.5}),second=stratifiedSample(tasks,{seed:'same',rate:.5});assert.deepEqual(first.selectedIds,second.selectedIds);assert.equal(first.selectedIds.length,6);assert.ok(first.strata.every(stratum=>stratum.selected.length===2));
});
test('WAV import preserves header sample rate instead of reporting the AudioContext resampling rate',()=>{
  const bytes=readFileSync(new URL('../public/assets/audio/D11_766.wav',import.meta.url));const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const metadata=readWavMetadata(buffer);assert.equal(metadata.sample_rate_hz,16000);assert.equal(metadata.channels,1);assert.equal(metadata.duration_s,12.958);assert.equal(readWavMetadata(new ArrayBuffer(10)),null);
  assert.equal(inspectJsonText('[]').issues[0].code,'E_EMPTY_BATCH');
});
