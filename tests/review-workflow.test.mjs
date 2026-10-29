import test from 'node:test';
import assert from 'node:assert/strict';
import {SEED_TASKS} from '../src/seed-data.js';
import {markEdited,validateBackup} from '../src/core.js';
import {startReview,applyReviewDecision,getCurrentReviews,upgradeReviewTask,validateReviewState} from '../src/review-workflow.js';

const options=(reviewer,decision='approved')=>({reviewer,decision,note:'已逐项核对素材与标注。',checksConfirmed:true,id:reviewer,at:'2026-10-29T07:00:00Z'});
const pending=()=>startReview(structuredClone(SEED_TASKS[0])).task;
const decide=(task,reviewer,decision)=>applyReviewDecision(task,options(reviewer,decision));
const backup=task=>({schemaVersion:'annota/1',tasks:[task]});

test('first opinion stays pending; a different second reviewer completes approval',()=>{
  const task=pending();const first=decide(task,'甲').task;assert.equal(first.status,'pending');assert.equal(task.reviews.length,0);
  assert.equal(first.reviews[0].decision,'opinion');assert.equal(getCurrentReviews(first).length,1);
  const approved=decide(first,'乙').task;assert.equal(approved.status,'approved');assert.deepEqual(validateBackup(backup(approved)),[]);
});
test('name, independent reason and manual checks are required before a pass',()=>{
  for(const change of [{reviewer:''},{note:' '},{checksConfirmed:false}])assert.equal(applyReviewDecision(pending(),{...options('甲'),...change}).ok,false);
  assert.equal(applyReviewDecision(pending(),{...options('甲','returned'),note:''}).ok,false);
});
test('trimmed, case-folded and fullwidth variants cannot bypass different-name checking',()=>{
  const first=decide(pending(),'Alex').task;
  for(const name of ['Alex',' alex ','Ａｌｅｘ'])assert.equal(decide(first,name).ok,false);
});
test('duplicate submissions cannot reset an active or completed review cycle',()=>{
  const task=pending();assert.equal(startReview(task).ok,false);
  const approved=decide(decide(task,'甲').task,'乙').task;assert.equal(startReview(approved).ok,false);assert.equal(decide(approved,'丙').ok,false);
});
test('editing and resubmission preserve history but require a fresh pair of opinions',()=>{
  const approved=decide(decide(pending(),'甲').task,'乙').task;
  const edited=markEdited(approved);assert.equal(getCurrentReviews(edited).length,0);
  const submitted=startReview(edited).task;assert.equal(submitted.reviewRound,2);assert.equal(submitted.reviews.length,2);
  const first=decide(submitted,'甲').task;assert.equal(first.status,'pending');assert.equal(first.reviews.at(-1).round,2);
  assert.deepEqual(validateBackup(backup(decide(first,'乙').task)),[]);
});
test('return then resubmit without an edit starts a new independent cycle',()=>{
  const returned=decide(decide(pending(),'甲').task,'乙','returned').task;
  const submitted=startReview(returned).task;assert.equal(submitted.reviewRound,2);assert.equal(getCurrentReviews(submitted).length,0);
  assert.equal(decide(submitted,'甲').task.status,'pending');assert.deepEqual(validateBackup(backup(submitted)),[]);
});
test('disputes block ordinary resubmission and accept a reasoned arbitration',()=>{
  const disputed=decide(decide(pending(),'甲').task,'乙','disputed').task;assert.equal(disputed.status,'disputed');
  assert.equal(startReview(disputed).ok,false);assert.equal(decide(disputed,'乙','disputed').ok,false);
  const approved=decide(disputed,'仲裁员').task;assert.equal(approved.reviews.at(-1).decision,'arbitrated');assert.equal(approved.status,'approved');assert.deepEqual(validateBackup(backup(approved)),[]);
  const returned=decide(disputed,'仲裁员','returned').task;assert.equal(returned.status,'returned');assert.deepEqual(validateReviewState(returned),[]);
});
test('backup rejects forged or inconsistent new review records',()=>{
  const approved=decide(decide(pending(),'甲').task,'乙').task;
  for(const mutate of [task=>task.reviews.shift(),task=>task.reviews[1].reviewer='甲',task=>task.reviews[0].round=99,task=>task.status='pending',task=>task.reviews[0].decision='unknown']) {
    const forged=structuredClone(approved);mutate(forged);assert(validateBackup(backup(forged)).some(issue=>issue.field.includes('reviews')));
  }
});
test('legacy approval and comments survive upgrade without claiming two-person evidence',()=>{
  const legacy=structuredClone(SEED_TASKS[0]);legacy.status='approved';legacy.reviews=[{decision:'approved',revision:1,note:'旧版意见'}];
  const upgraded=upgradeReviewTask(legacy);assert.equal(upgraded.status,'approved');assert.equal(upgraded.reviewRound,0);assert.deepEqual(upgraded.reviews,legacy.reviews);assert.equal(getCurrentReviews(upgraded).length,0);assert.deepEqual(validateBackup(backup(upgraded)),[]);
  legacy.status='pending';const resumed=upgradeReviewTask(legacy);assert.equal(resumed.reviewRound,1);assert.equal(decide(resumed,'甲').task.status,'pending');
});
test('all three annotation modalities use the same two-person state machine',()=>{
  for(const id of ['DOL-001','SDA-001','SDR-001']) {
    const task=startReview(structuredClone(SEED_TASKS.find(task=>task.id===id))).task;
    assert.deepEqual(validateBackup(backup(decide(decide(task,'甲').task,'乙').task)),[]);
  }
});
