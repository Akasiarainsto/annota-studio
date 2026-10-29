import {query,transaction,selectRows} from './db.js';
import {requireMember,lockTask,appendEvent} from './access.js';
import {requireCondition,requireText} from './http.js';
import {sampleStrata,calculateKappa} from '../src/operations-core.js';

const MANAGERS=['owner','manager'];
const REVIEWERS=['owner','manager','reviewer'];
export async function listBatches(userId,projectId) {
  await requireMember(userId,projectId);return query('SELECT * FROM annota.batches WHERE project_id=$1 ORDER BY created_at DESC LIMIT 100',[projectId]);
}
export async function createBatch(userId,options) {
  await requireMember(userId,options.projectId,{roles:MANAGERS});requireCondition(options.reviewerA!==options.reviewerB,400,'须选择两个不同复核账号');
  await requireMember(options.reviewerA,options.projectId,{roles:REVIEWERS});await requireMember(options.reviewerB,options.projectId,{roles:REVIEWERS});
  const seed=requireText(options.seed,'随机种子',100);
  requireCondition(['modality','difficulty','assignee_id'].includes(options.field)&&Number.isFinite(Number(options.rate))&&Number(options.rate)>0&&Number(options.rate)<=1,400,'分层字段或抽样比例不合法');
  const candidates=await query(`SELECT * FROM annota.tasks t WHERE project_id=$1 AND status='pending' AND submitted_by<>$2 AND submitted_by<>$3 AND NOT EXISTS(SELECT 1 FROM annota.samples s WHERE s.task_id=t.id AND s.revision=(t.payload->>'revision')::bigint AND s.submission=t.submission_count) ORDER BY t.id LIMIT 1000`,[options.projectId,options.reviewerA,options.reviewerB]);
  requireCondition(candidates.length,400,'没有符合条件的待检任务；已抽样任务和两位复核人自己提交的任务已排除');
  const strata=sampleStrata(candidates,{field:options.field,rate:Number(options.rate),seed});
  return transaction(async client=>{
    const [batch]=await selectRows(client,'INSERT INTO annota.batches(project_id,created_by,reviewer_a,reviewer_b,field,rate,seed,strata) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[options.projectId,userId,options.reviewerA,options.reviewerB,options.field,options.rate,seed,JSON.stringify(strata.map(group=>({stratum:group.stratum,population:group.population,sampleSize:group.sampleSize,taskIds:group.tasks.map(task=>task.id)})))]);
    for(const group of strata)for(const task of group.tasks){const snapshot={...task.payload,status:task.status,media:{...task.payload.media,cloudMediaId:task.media_id||undefined}};await client.query('INSERT INTO annota.samples(batch_id,task_id,revision,submission,snapshot,stratum) VALUES($1,$2,$3,$4,$5,$6)',[batch.id,task.id,task.payload.revision,task.submission_count,JSON.stringify(snapshot),group.stratum]);}
    return batch;
  });
}
function isStale(sample) {return sample.outcome==='open'&&(Number(sample.current_revision)!==Number(sample.revision)||sample.current_submission!==sample.submission||sample.task_status!=='pending');}
export async function readBatch(userId,id) {
  const [batch]=await query('SELECT * FROM annota.batches WHERE id=$1',[id]);requireCondition(batch,404,'抽检批次不存在');const member=await requireMember(userId,batch.project_id);
  const samples=await query(`SELECT s.*,t.payload->>'revision' AS current_revision,t.submission_count AS current_submission,t.status AS task_status,t.submitted_by FROM annota.samples s JOIN annota.tasks t ON t.id=s.task_id WHERE batch_id=$1 ORDER BY s.id`,[id]);
  const votes=await query('SELECT v.*,u.name FROM annota.votes v JOIN annota.samples s ON s.id=v.sample_id JOIN annota.users u ON u.id=v.reviewer_id WHERE s.batch_id=$1',[id]);
  const pairs=[];
  const entries=samples.map(sample=>{
    const opinions=votes.filter(vote=>vote.sample_id===sample.id);const completed=opinions.length===2;
    if(completed&&sample.outcome!=='stale')pairs.push([opinions.find(vote=>vote.reviewer_id===batch.reviewer_a)?.verdict,opinions.find(vote=>vote.reviewer_id===batch.reviewer_b)?.verdict]);
    return {...sample,outcome:isStale(sample)?'stale':sample.outcome,ownVote:opinions.find(vote=>vote.reviewer_id===userId)||null,votes:completed?opinions:[],voteCount:opinions.length,canArbitrate:MANAGERS.includes(member.role)&&sample.submitted_by!==userId&&sample.outcome==='disputed',canVote:REVIEWERS.includes(member.role)&&[batch.reviewer_a,batch.reviewer_b].includes(userId)&&!completed&&!isStale(sample)&&sample.outcome==='open'&&!opinions.some(vote=>vote.reviewer_id===userId)};
  });
  return {batch,samples:entries,kappa:calculateKappa(pairs)};
}
async function finishSample(client,{sample,task,actorId,outcome,arbitration=null}) {
  const status={pass:'approved',fail:'returned',disputed:'disputed'}[outcome];
  await client.query('UPDATE annota.samples SET outcome=$2,arbitration=$3 WHERE id=$1',[sample.id,outcome,arbitration?JSON.stringify(arbitration):null]);
  await client.query(`UPDATE annota.tasks SET status=$2,return_count=return_count+$3,version=version+1,updated_at=now() WHERE id=$1`,[task.id,status,Number(status==='returned')]);
  await appendEvent(client,{taskId:task.id,actorId,kind:status,meta:{sampleId:sample.id,revision:sample.revision,submitted_by:task.submitted_by,arbitration}});
  return {outcome,status};
}
export async function voteSample(userId,options) {
  requireCondition(['pass','fail'].includes(options.verdict),400,'判断须为合格或不合格');const note=requireText(options.note,'独立复核意见');
  return transaction(async client=>{
    const [sample]=await selectRows(client,'SELECT s.*,b.project_id,b.reviewer_a,b.reviewer_b FROM annota.samples s JOIN annota.batches b ON b.id=s.batch_id WHERE s.id=$1 FOR UPDATE OF s',[options.id]);requireCondition(sample,404,'样本不存在');
    await requireMember(userId,sample.project_id,{roles:REVIEWERS,client});requireCondition([sample.reviewer_a,sample.reviewer_b].includes(userId),403,'你不是此样本指定复核人');
    const {task}=await lockTask(client,userId,sample.task_id);requireCondition(task.submitted_by!==userId,403,'不能复核自己提交的标注');
    requireCondition(sample.outcome==='open'&&task.status==='pending'&&task.payload.revision===Number(sample.revision)&&task.submission_count===sample.submission,409,'样本已完成或修订已变化，请重新抽样');
    await client.query('INSERT INTO annota.votes(sample_id,reviewer_id,verdict,note) VALUES($1,$2,$3,$4)',[sample.id,userId,options.verdict,note]);
    const votes=await selectRows(client,'SELECT * FROM annota.votes WHERE sample_id=$1',[sample.id]);
    if(votes.length<2)return {outcome:'open',voteCount:votes.length};
    const outcome=votes[0].verdict===votes[1].verdict?votes[0].verdict:'disputed';return finishSample(client,{sample,task,actorId:userId,outcome});
  });
}
export async function arbitrateSample(userId,options) {
  requireCondition(['pass','fail'].includes(options.verdict),400,'仲裁判断无效');const note=requireText(options.note,'仲裁理由');
  return transaction(async client=>{
    const [sample]=await selectRows(client,'SELECT s.*,b.project_id FROM annota.samples s JOIN annota.batches b ON b.id=s.batch_id WHERE s.id=$1 FOR UPDATE OF s',[options.id]);requireCondition(sample,404,'样本不存在');await requireMember(userId,sample.project_id,{roles:MANAGERS,client});
    const {task}=await lockTask(client,userId,sample.task_id);requireCondition(task.submitted_by!==userId,403,'不能仲裁自己的标注');requireCondition(sample.outcome==='disputed'&&task.status==='disputed'&&task.payload.revision===Number(sample.revision)&&task.submission_count===sample.submission,409,'当前样本不处于可仲裁状态');
    return finishSample(client,{sample,task,actorId:userId,outcome:options.verdict,arbitration:{reviewerId:userId,note,verdict:options.verdict,at:new Date().toISOString()}});
  });
}
