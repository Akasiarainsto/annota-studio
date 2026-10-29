import test from 'node:test';
import assert from 'node:assert/strict';
import {SEED_TASKS} from '../src/seed-data.js';
import {validateAnnotationText,validateLiveTask} from '../src/json-validation.js';
import {createAnnotationDocument,toTrainingRecord} from '../src/validation-adapters.js';
import {VALIDATION_CASES} from '../src/validation-samples.js';

const INVENTORY=new Set(['images/placeholder_a.png','images/placeholder_b.png','images/placeholder_c.png','workspace.jpg','image_good.svg']);
const run=(text,modality,format='json')=>validateAnnotationText(text,format,{modality,inventory:INVENTORY});
const EXPECTED={audio:{valid:[3,0,0],time_out:[1,1,1],reversed:[1,1,1],missing:[1,1,1],speaker:[1,1,1],noise:[1,1,1],invalid:[5,5,5],corrected:[5,0,0],overlap:[1,1,1],attribute:[1,1,1]},video:{valid:[1,0,0],time_out:[1,1,1],reversed:[1,1,1],missing:[1,1,1],invalid:[3,3,3],corrected:[3,0,0],overlap:[1,1,1],caption_count:[1,1,1]},image:{valid:[2,0,0],practice_before:[1,1,1],practice_after:[1,0,0],invalid:[13,13,17],tag_error:[1,1,2],missing_file:[1,1,1],path_escape:[1,1,1]}};
for(const modality of ['audio','video','image'])for(const sample of VALIDATION_CASES[modality])test(`${modality}: ${sample.key} matches the original modality-specific example`,()=>{
  const report=run(sample.text,modality,sample.format);
  assert.deepEqual([report.total,report.failed,report.issues.length],EXPECTED[modality][sample.key]);
  assert.equal(report.valid,report.issues.length===0);
});
test('modality contracts differ and mismatched media is explicitly rejected',()=>{
  const image=VALIDATION_CASES.image[0].text;
  for(const modality of ['audio','video'])assert(run(image,modality).issues.every(issue=>issue.code==='MODALITY_MISMATCH'));
  assert.notEqual(run(image,'image').ruleVersion,run(VALIDATION_CASES.audio[0].text,'audio').ruleVersion);
});
test('image inventory is real input to checking, and missing references fail',()=>{
  const report=validateAnnotationText(VALIDATION_CASES.image[0].text,'json',{modality:'image',inventory:new Set()});
  assert.equal(report.failed,2);assert(report.issues.every(issue=>issue.code==='IMAGE_MISSING'));
});
test('duplicate IDs and cross-split image paths mark every related record',()=>{
  const rows=JSON.parse(VALIDATION_CASES.image[0].text);rows[1].sample_id=rows[0].sample_id;rows[1].image_path='IMAGES/./placeholder_a.png';rows[1].split='test';
  const report=run(JSON.stringify(rows),'image');assert.equal(report.failed,2);assert.equal(report.issues.filter(i=>i.code==='DUPLICATE_ID').length,2);assert.equal(report.issues.filter(i=>i.code==='CROSS_SPLIT_IMAGE').length,2);
});
test('audio rejects overlap; video accepts overlap only with an explicit reason',()=>{
  const audio=JSON.parse(VALIDATION_CASES.audio.find(s=>s.key==='overlap').text);assert(run(JSON.stringify(audio),'audio').issues.some(i=>i.code==='AUDIO_OVERLAP'));
  const video=JSON.parse(VALIDATION_CASES.video.find(s=>s.key==='overlap').text);video[0].segments[1].overlap_reason='同步记录两个动作维度，已人工确认。';assert.equal(run(JSON.stringify(video),'video').valid,true);
});
test('JSONL bad lines continue, preserving physical line and exact edit location',()=>{
  const good=JSON.parse(VALIDATION_CASES.video[0].text)[0];const bad=structuredClone(good);bad.sample_id='bad_end';bad.segments[0].end=99;
  const source=JSON.stringify(good)+'\n\n{\n'+JSON.stringify(bad);const report=run(source,'video','jsonl');assert.equal(report.total,3);assert.equal(report.failed,2);
  const issue=report.issues.find(i=>i.code==='TIME_OUT_OF_BOUNDS');assert.equal(issue.line,4);assert(source.slice(issue.offset,issue.offset+issue.length).startsWith('{'));
});
test('duplicates, non-finite numbers and excessive nesting cannot silently pass',()=>{
  assert(run('{"id":1,"i\\u0064":2}','audio').issues.some(i=>i.code==='DUPLICATE_KEY'));
  assert(run('{"duration":1e400}','audio').issues.some(i=>i.code==='NUMBER_RANGE'));
  assert(run('['.repeat(85)+'0'+']'.repeat(85),'video').issues.some(i=>i.code==='INPUT_LIMIT'));
});
test('current annotations adapt to the selected contract without rewriting source data',()=>{
  const before=JSON.stringify(SEED_TASKS);
  for(const task of SEED_TASKS.filter(task=>['DOL-001','DOL-003','SDA-001','SDR-001','SDR-002'].includes(task.id))){
    assert.equal(run(JSON.stringify(createAnnotationDocument(task)),task.modality).valid,true);
    assert.equal(validateLiveTask(task).length,0);
  }
  assert.equal(JSON.stringify(SEED_TASKS),before);
});
test('backup validation explicitly filters to the selected modality',()=>{
  const report=run(JSON.stringify({schemaVersion:'annota/1',tasks:SEED_TASKS}),'image');assert.equal(report.total,2);assert.equal(report.skipped,5);assert.equal(report.valid,true);
});
test('live required fields, enum values and time order use the same blocking rules',()=>{
  const audio=structuredClone(SEED_TASKS[0]);audio.segments[0].text='';assert(validateLiveTask(audio).some(i=>i.code==='TRANSCRIPT_MISSING'));
  audio.segments[0].text='已核对';audio.segments[0].dialect='随意值';assert(validateLiveTask(audio).some(i=>i.code==='DIALECT_ENUM'));
  audio.segments[1].language='';assert(validateLiveTask(audio).some(i=>i.field==='segments.1.language'));
  const video=structuredClone(SEED_TASKS.find(t=>t.id==='SDA-001'));video.segments[0].end=0;assert(validateLiveTask(video).some(i=>i.code==='SEGMENT_ORDER'));
});
test('empty or evaluation-only documents do not pass as valid annotation',()=>{
  for(const source of ['[]','','{"kind":"evaluation"}','{"tasks":null}'])assert.equal(run(source,'audio').valid,false);
  const record=toTrainingRecord(SEED_TASKS[0]);assert(Object.hasOwn(record,'noise_tags'));assert(!Object.hasOwn(record,'evaluation'));
});
