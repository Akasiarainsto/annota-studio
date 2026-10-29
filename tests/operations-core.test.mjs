import test from 'node:test';
import assert from 'node:assert/strict';
import {getClipRange,calculateKappa,sampleStrata,summarizePeople} from '../src/operations-core.js';
import {encodeWav} from '../src/wav-encoder.js';

test('quick clips preserve requested duration and reject tail truncation or invalid presets',()=>{
  assert.deepEqual(getClipRange({start:2,duration:20,clipSeconds:10}),{ok:true,start:2,end:12});
  for(const range of [{start:2,duration:4,clipSeconds:3},{start:0,duration:20,clipSeconds:2},{start:-1,duration:20,clipSeconds:5},{start:0,duration:20,clipSeconds:3.5}])assert.equal(getClipRange(range).ok,false);
});
test('Kappa distinguishes observed agreement from chance agreement',()=>{
  const report=calculateKappa([['pass','pass'],['pass','pass'],['fail','fail'],['fail','pass']]);
  assert.equal(report.n,4);assert.equal(report.po,.75);assert.equal(report.pe,.5);assert.equal(report.kappa,.5);assert.deepEqual(report.counts,[[2,0],[1,1]]);
  assert.equal(calculateKappa([['pass','pass'],['fail','fail']]).kappa,1);
  assert.equal(calculateKappa([['pass','fail'],['fail','pass']]).kappa,-1);
});
test('Kappa excludes incomplete labels and handles undefined chance denominator',()=>{
  assert.equal(calculateKappa([['pass',null],['unknown','fail']]).n,0);
  const report=calculateKappa([['pass','pass'],['pass','pass']]);assert.equal(report.kappa,null);assert.equal(report.pe,1);assert.match(report.reason,/Pe=1/);
});
test('stratified sampling is reproducible, covers small strata and never duplicates a task',()=>{
  const tasks=Array.from({length:21},(_,index)=>({id:`task_${index}`,modality:index<20?'audio':'video'}));
  const settings={field:'modality',rate:.2,seed:'fixed'};const first=sampleStrata(tasks,settings);assert.deepEqual(first,sampleStrata([...tasks].reverse(),settings));assert.deepEqual(first.map(group=>group.sampleSize),[4,1]);assert.equal(new Set(first.flatMap(group=>group.tasks.map(task=>task.id))).size,5);
  assert.equal(sampleStrata(tasks,{...settings,rate:1}).flatMap(group=>group.tasks).length,21);assert.throws(()=>sampleStrata(tasks,{...settings,rate:0}));
});
test('people metrics use actual submitters, deduplicated audit events and separate work types',()=>{
  const members=[{user_id:'a'},{user_id:'b'},{user_id:'c'}];const tasks=[{id:'1',assignee_id:'b',submitted_by:'a',status:'approved'},{id:'2',assignee_id:'a',submitted_by:'a',status:'returned'}];
  const sessions=[{user_id:'a',task_id:'1',seconds:3600,work_type:'annotation'},{user_id:'b',task_id:'1',seconds:600,work_type:'review'},{user_id:'a',task_id:'other',seconds:99999}];
  const events=[{task_id:'1',actor_id:'a',kind:'submit',meta:{}},{task_id:'2',actor_id:'a',kind:'submit',meta:{}},{task_id:'2',actor_id:'a',kind:'submit',meta:{}},{task_id:'2',actor_id:'b',kind:'returned',meta:{submitted_by:'a'}}];
  const report=summarizePeople({members,tasks,sessions,events,votes:[{reviewer_id:'b',task_id:'1'}]});assert.equal(report[0].tasksPerHour,1);assert.equal(report[0].reworkRate,.5);assert.equal(report[0].progress,0);assert.equal(report[1].progress,1);assert.equal(report[1].reviewsPerHour,6);assert.equal(report[2].tasksPerHour,null);assert.equal(report[2].reworkRate,null);
});
test('WAV export contains actual cropped stereo PCM samples and accurate duration',async()=>{
  const samples=[new Float32Array([0,.25,.5,.75,1,-1]),new Float32Array([0,-.25,-.5,-.75,-1,1])];
  const buffer={sampleRate:2,numberOfChannels:2,length:6,getChannelData:index=>samples[index]};
  const blob=encodeWav(buffer,{start:.5,end:2.5}),bytes=await blob.arrayBuffer(),view=new DataView(bytes);
  assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'RIFF');assert.equal(view.getUint16(22,true),2);assert.equal(view.getUint32(24,true),2);assert.equal(view.getUint32(40,true),16);assert.equal(view.getInt16(44,true),8191);assert.equal(view.getInt16(46,true),-8192);assert.equal((bytes.byteLength-44)/(2*2*2),2);
});
