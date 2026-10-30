import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudTaskStore} from '../src/cloud-task-store.js';

const makeInitial=()=>({version:1,task:{id:'fixture',caption:'initial',media:{url:'blob:private'}},canEdit:true});
test('queued saves preserve newer edits and use the last server version',async()=>{
  const gates=[],requests=[];
  const api=async(path,options)=>{requests.push(options.body);await new Promise(resolve=>gates.push(resolve));return {version:requests.length+1,task:{...options.body.task,revision:requests.length,media:{url:''}}};};
  const store=createCloudTaskStore({initial:makeInitial(),api,user:{id:'worker'}});
  store.tasks[0].caption='first';const first=store.saveTasks(store.tasks);
  store.tasks[0].caption='second';const second=store.saveTasks(store.tasks);
  gates.shift()();await first;assert.equal(store.tasks[0].caption,'second');
  gates.shift()();await second;assert.equal(requests[1].version,2);assert.equal(store.tasks[0].media.url,'blob:private');assert.equal(store.pending,false);
});
test('conflict prevents further writes and leaves editable contents available for export',async()=>{
  let requests=0;const api=async()=>{requests++;throw Object.assign(new Error('conflict'),{status:409});};
  const store=createCloudTaskStore({initial:makeInitial(),api,user:{id:'worker'}});
  store.tasks[0].caption='unsynced edit';await assert.rejects(store.saveTasks(store.tasks),/conflict/);
  await assert.rejects(store.saveTasks(store.tasks),/版本冲突/);assert.equal(store.tasks[0].caption,'unsynced edit');assert.equal(requests,1);
});
test('submission waits for queued save completion and sends the current version',async()=>{
  const calls=[];let release;
  const api=async(path,options)=>{calls.push({path,...options.body});if(calls.length===1)await new Promise(resolve=>{release=resolve;});return {version:calls.length+1,task:{...options.body.task,status:path.endsWith('/submit')?'pending':'draft',media:{url:''}}};};
  const store=createCloudTaskStore({initial:makeInitial(),api,user:{id:'worker'}});
  const saving=store.saveTasks(store.tasks),submitting=store.submit();release();await saving;await submitting;
  assert.equal(calls.at(-1).path,'tasks/fixture/submit');assert.equal(calls.at(-1).version,3);assert.equal(store.tasks[0].status,'pending');
});
