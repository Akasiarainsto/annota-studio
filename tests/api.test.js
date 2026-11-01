import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {startServer} from '../server/index.js';
import {createStore} from '../server/sqlite-store.js';
import {seedTasks} from '../server/seed.js';
import {createTimerService} from '../server/timer-service.js';
import {fileURLToPath} from 'node:url';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'annota-local-test-'));const server=startServer({port:0,dataRoot:directory});await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));assert.ok(directory.startsWith(join(tmpdir(),'annota-local-test-')));await rm(directory,{recursive:true,force:true});});
  const clients={};
  for(const user of ['annotator','reviewer_a','reviewer_b','manager']){
    const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:user,password:'demo1234'})});const cookie=login.headers.get('set-cookie').split(';')[0];
    clients[user]=async(path,method='GET',body)=>{const response=await fetch(base+'/api'+path,{method,headers:{Cookie:cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
  }
  return {base,clients};
}
async function submitAudio(client){
  let {body:task}=await client('/tasks/A-001');task.draft.segments.forEach(segment=>segment.boundary_status='confirmed');task.draft.segments[1].transcript=task.draft.segments[1].transcript.replace('胎','滩');task.draft.segments[2].transcript=task.draft.segments[2].transcript.replace('章','张');
  ({body:task}=await client('/tasks/A-001','PUT',{version:task.version,document:task.draft}));return (await client('/tasks/A-001/submit','POST',{version:task.version})).body;
}
const reviewBody=(task,decision)=>({version:task.version,decision,checks:[true,true,true,true],target:'S02',note:decision==='fail'?'术语仍需复听核对':''});
test('real independent users, sealed opinions, dispute arbitration, immutable rounds and stale writes',async t=>{
  const {clients:c}=await fixture(t);const a=c.annotator,first=c.reviewer_a,second=c.reviewer_b,manager=c.manager;
  const draft=(await a('/tasks/A-001')).body;
  assert.equal((await a('/tasks/A-001/submit','POST',{version:draft.version})).status,422);
  let task=await submitAudio(a);assert.equal(task.status,'pending');assert.equal(task.rounds.length,1);
  assert.equal((await a('/tasks/A-001/review','POST',reviewBody(task,'pass'))).status,403);
  assert.equal((await a('/tasks/A-001','PUT',{version:task.version,document:task.draft})).status,403);
  task=(await first('/tasks/A-001/review','POST',reviewBody(task,'fail'))).body;assert.equal(task.status,'pending');
  assert.equal((await first('/tasks/A-001/review','POST',reviewBody(task,'pass'))).status,403);
  const sealed=(await second('/tasks/A-001')).body;assert.equal(sealed.reviews.length,0);assert.equal(sealed.reviewCount,1);assert.equal(sealed.ownReview,null);
  assert.ok(!JSON.stringify(sealed.events).includes('术语仍需'));
  task=(await second('/tasks/A-001/review','POST',reviewBody(sealed,'pass'))).body;assert.equal(task.status,'disputed');assert.equal(task.reviews.length,2);
  assert.equal((await first('/tasks/A-001/arbitrate','POST',{version:task.version,decision:'pass',note:'test'})).status,403);
  task=(await manager('/tasks/A-001/arbitrate','POST',{version:task.version,decision:'fail',note:'需复听术语并补充依据'})).body;assert.equal(task.status,'returned');
  const frozen=structuredClone(task.rounds[0].document);task.draft.segments[1].note='已复听并保留公开参考词';
  const saved=(await a('/tasks/A-001','PUT',{version:task.version,document:task.draft})).body;
  assert.equal((await a('/tasks/A-001','PUT',{version:task.version,document:task.draft})).status,409);
  task=(await a('/tasks/A-001/submit','POST',{version:saved.version})).body;assert.equal(task.round,2);assert.deepEqual(task.rounds[0].document,frozen);
  task=(await first('/tasks/A-001/review','POST',reviewBody(task,'pass'))).body;task=(await second('/tasks/A-001/review','POST',reviewBody(task,'pass'))).body;assert.equal(task.status,'approved');assert.equal(task.reviews.length,4);
  const dashboard=await manager('/dashboard');assert.equal(dashboard.status,200);assert.equal(dashboard.body.kappa.n,1);assert.equal(dashboard.body.members.find(member=>member.id==='annotator').reworked,1);
  assert.equal((await a('/dashboard')).status,403);
});
test('double failure waits for both reviewers then returns; media metadata cannot bypass validation',async t=>{
  const {clients:c,base}=await fixture(t);const a=c.annotator;
  const draft=(await a('/tasks/A-001')).body;draft.draft.media.duration_s=100;
  assert.equal((await a('/tasks/A-001','PUT',{version:draft.version,document:draft.draft})).status,400);
  let task=await submitAudio(a);task=(await c.reviewer_a('/tasks/A-001/review','POST',reviewBody(task,'fail'))).body;assert.equal(task.status,'pending');
  task=(await c.reviewer_b('/tasks/A-001/review','POST',reviewBody(task,'fail'))).body;assert.equal(task.status,'returned');
  const unauth=await fetch(base+'/api/tasks');assert.equal(unauth.status,401);
  const range=await fetch(base+'/assets/video/case2_veo3_1_fast.mp4',{headers:{Range:'bytes=0-1023'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,1024);
  const manager=c.manager;const sample=await manager('/sample','POST',{seed:'test',rate:.5});assert.equal(sample.body.populationSize,1);assert.deepEqual(sample.body.selectedIds,['A-001']);
});
test('SQLite persists task revisions across database reopen; stale timer gap is capped and stops',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'annota-persistence-test-'));
  t.after(async()=>{assert.ok(directory.startsWith(join(tmpdir(),'annota-persistence-test-')));await rm(directory,{recursive:true,force:true});});
  const filename=join(directory,'workbench.sqlite');const first=createStore(filename);seedTasks(first,fileURLToPath(new URL('..',import.meta.url)));
  const task=first.getTask('A-001');task.draft.segments[0].note='重启后仍应保留';task.version++;assert.equal(first.saveTask(task,1),true);first.close();
  const reopened=createStore(filename);assert.equal(reopened.getTask('A-001').draft.segments[0].note,'重启后仍应保留');
  reopened.saveTimer('annotator',{active:true,taskId:'A-001',last:Date.now()-90000,totals:{}});
  const timer=createTimerService(reopened).get({id:'annotator'});assert.equal(timer.totals['A-001'],60000);assert.equal(timer.active,false);reopened.close();
});
test('review withdrawal is own-only, preserves history, seals peers and excludes withdrawn votes',async t=>{
  const {clients:c}=await fixture(t);let task=await submitAudio(c.annotator);
  task=(await c.reviewer_a('/tasks/A-001/review','POST',reviewBody(task,'pass'))).body;
  assert.equal(task.canWithdrawReview,true);
  assert.equal((await c.reviewer_b('/tasks/A-001/withdraw_review','POST',{version:task.version,reason:'尝试撤回他人意见'})).status,403);
  assert.equal((await c.reviewer_a('/tasks/A-001/withdraw_review','POST',{version:task.version,reason:''})).status,400);
  const frozen=structuredClone(task.rounds[0].document);
  task=(await c.reviewer_a('/tasks/A-001/withdraw_review','POST',{version:task.version,reason:'刚才误点通过，应重新核查术语'})).body;
  assert.equal(task.reviewCount,0);assert.equal(task.canReview,true);assert.equal(task.reviews[0].decision,'pass');assert.ok(task.reviews[0].withdrawnAt);
  const peer=(await c.reviewer_b('/tasks/A-001')).body;assert.equal(peer.reviews.length,0);assert.ok(!peer.events.some(event=>event.kind==='review_withdrawn'));
  task=(await c.reviewer_a('/tasks/A-001/review','POST',reviewBody(task,'fail'))).body;
  task=(await c.reviewer_b('/tasks/A-001/review','POST',reviewBody(task,'fail'))).body;
  assert.equal(task.status,'returned');assert.equal(task.reviews.length,3);assert.equal(task.reviewCount,2);assert.deepEqual(task.rounds[0].document,frozen);
  const dashboard=(await c.manager('/dashboard')).body;assert.equal(dashboard.kappa.n,1);assert.equal(dashboard.kappa.matrix.fail_fail,1);
});
test('completed result correction is held, independently reopened and can also be rejected',async t=>{
  const {clients:c}=await fixture(t);let task=await submitAudio(c.annotator);
  task=(await c.reviewer_a('/tasks/A-001/review','POST',reviewBody(task,'pass'))).body;
  task=(await c.reviewer_b('/tasks/A-001/review','POST',reviewBody(task,'pass'))).body;
  const frozen=structuredClone(task.rounds[0].document);
  assert.equal((await c.reviewer_a('/tasks/A-001/withdraw_review','POST',{version:task.version,reason:'已结束的轮次不能直接撤回'})).status,403);
  task=(await c.reviewer_a('/tasks/A-001/request_correction','POST',{version:task.version,reason:'提交的通过结论有误，申请重新复核'})).body;
  assert.equal(task.status,'correction_pending');assert.equal((await c.manager('/dashboard')).body.kappa.n,0);
  assert.equal((await c.reviewer_a('/tasks/A-001/resolve_correction','POST',{version:task.version,decision:'reopen',reason:'自己处理自己的申请'})).status,403);
  task=(await c.manager('/tasks/A-001/resolve_correction','POST',{version:task.version,decision:'reopen',reason:'同意对同一冻结结果重新判断'})).body;
  assert.equal(task.round,2);assert.equal(task.status,'pending');assert.equal(task.reviewCount,0);assert.equal(task.rounds[0].supersededBy,2);assert.deepEqual(task.rounds[0].document,frozen);assert.deepEqual(task.rounds[1].document,frozen);assert.equal((await c.manager('/dashboard')).body.kappa.n,0);
  task=(await c.reviewer_a('/tasks/A-001/review','POST',reviewBody(task,'fail'))).body;task=(await c.reviewer_b('/tasks/A-001/review','POST',reviewBody(task,'fail'))).body;
  assert.equal(task.status,'returned');assert.equal((await c.manager('/dashboard')).body.kappa.matrix.fail_fail,1);
  task=(await c.reviewer_a('/tasks/A-001/request_correction','POST',{version:task.version,reason:'申请测试驳回流程'})).body;
  task=(await c.manager('/tasks/A-001/resolve_correction','POST',{version:task.version,decision:'reject',reason:'本次没有新增依据，保留退回结论'})).body;
  assert.equal(task.status,'returned');assert.equal(task.round,2);assert.equal(task.correctionRequests.at(-1).status,'rejected');
});
