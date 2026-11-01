import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {seedTasks} from '../server/seed.js';
import {createHistory} from '../public/src/services/history.js';
import {mergeSegment,setSegmentRange,addSegment} from '../public/src/core/segments.js';
import {makeValidExample,makeInvalidExample,ERROR_CASES} from '../public/src/services/samples.js';
import {inspectJsonText} from '../public/src/core/json-validation.js';

function fixtures(){const tasks=[];seedTasks({addTask:task=>tasks.push(task)},fileURLToPath(new URL('..',import.meta.url)));return tasks;}
test('all nine modality error examples are real JSON errors; restoring their text passes with the same case selected',()=>{
  const tasks=fixtures();
  for(const modality of ['audio','video','image']) {
    const task=tasks.find(task=>task.modality===modality);const original=JSON.stringify(task);
    const valid=makeValidExample(task);assert.equal(inspectJsonText(JSON.stringify(valid)).valid,true);
    for(const [kind] of ERROR_CASES[modality])assert.equal(inspectJsonText(JSON.stringify(makeInvalidExample(task,kind))).valid,false,`${modality}/${kind}`);
    assert.equal(JSON.stringify(task),original,'loading samples must not alter saved annotations or reference data');
  }
});
test('merge undo and redo restore complete segments including time, caption, dimensions and notes',()=>{
  const before=fixtures().find(task=>task.id==='V-001').draft;const history=createHistory();assert.equal(history.canUndo,false);
  history.push(before);const merged=mergeSegment(before,'VS01');assert.equal(merged.segments.length,3);assert.equal(history.canUndo,true);
  const restored=history.undo(merged);assert.deepEqual(restored,before);assert.equal(history.canRedo,true);assert.deepEqual(history.redo(restored),merged);
});
test('a selected range may crop the current segment without treating that same segment as a collision',()=>{
  const document=fixtures().find(task=>task.id==='V-001').draft;let merged=document;
  while(merged.segments.length>1)merged=mergeSegment(merged,'VS01');
  const cropped=setSegmentRange(merged,{id:'VS01',start:1,end:3});
  assert.equal(cropped.segments.length,1);assert.equal(cropped.segments[0].start_s,1);assert.equal(cropped.segments[0].end_s,3);assert.equal(cropped.segments[0].caption,merged.segments[0].caption);assert.equal(cropped.segments[0].boundary_status,'pending_listen');
  assert.equal(merged.segments[0].start_s,0);assert.equal(merged.segments[0].end_s,8,'source document unchanged');
});
test('new or adjusted segments still reject actual overlaps; new segments work in an empty gap',()=>{
  const document=fixtures().find(task=>task.id==='V-001').draft;
  assert.throws(()=>addSegment(document,{start:1,end:2}),/VS01/);
  assert.throws(()=>setSegmentRange(document,{id:'VS01',start:0,end:3}),/VS02/);
  const shorter={...structuredClone(document),segments:[structuredClone(document.segments[0])]};shorter.segments[0].end_s=2;
  const next=addSegment(shorter,{start:3,end:4});assert.equal(next.segments.length,2);assert.equal(next.segments[1].caption,'');
});
