import {transaction,selectRows} from './db.js';
import {lockTask,canEditTask} from './access.js';
import {requireCondition} from './http.js';

const HEARTBEAT_GRACE_SECONDS=60;
async function requireWorkAccess(client,userId,options) {
  const context=await lockTask(client,userId,options.taskId);
  if(options.action==='stop')return;
  if(options.workType!=='review'){
    requireCondition(canEditTask(userId,context),403,'只有可编辑此任务的成员能记录标注工时');return;
  }
  const assignments=await selectRows(client,`SELECT s.id FROM annota.samples s JOIN annota.batches b ON b.id=s.batch_id WHERE s.task_id=$1 AND s.outcome='open' AND (b.reviewer_a=$2 OR b.reviewer_b=$2) AND s.revision=$3 AND s.submission=$4 AND NOT EXISTS(SELECT 1 FROM annota.votes v WHERE v.sample_id=s.id AND v.reviewer_id=$2)`,[options.taskId,userId,context.task.payload.revision,context.task.submission_count]);
  requireCondition(assignments.length&&context.task.status==='pending'&&['owner','manager','reviewer'].includes(context.member.role)&&context.task.submitted_by!==userId,403,'只有本轮尚未提交意见的指定复核人可记录复核工时');
}
export async function recordSession(userId,options) {
  requireCondition(['start','heartbeat','stop'].includes(options.action),400,'计时动作无效');
  requireCondition(['annotation','review'].includes(options.workType),400,'作业类型无效');
  return transaction(async client=>{
    // Serialize one account across different tasks as well as different devices.
    await client.query('SELECT id FROM annota.users WHERE id=$1 FOR UPDATE',[userId]);
    await requireWorkAccess(client,userId,options);
    await client.query(`UPDATE annota.sessions SET ended_at=heartbeat_at+($2*interval '1 second'),seconds=seconds+$2 WHERE user_id=$1 AND ended_at IS NULL AND heartbeat_at<now()-($2*interval '1 second')`,[userId,HEARTBEAT_GRACE_SECONDS]);
    if(options.action==='start'){
      const [existing]=await selectRows(client,'SELECT * FROM annota.sessions WHERE user_id=$1 AND ended_at IS NULL',[userId]);
      if(existing){requireCondition(existing.task_id===options.taskId&&existing.work_type===options.workType,409,'请先暂停其他任务或作业类型的计时');return existing;}
      return (await selectRows(client,'INSERT INTO annota.sessions(user_id,task_id,work_type) VALUES($1,$2,$3) RETURNING *',[userId,options.taskId,options.workType]))[0];
    }
    const [record]=await selectRows(client,`UPDATE annota.sessions SET seconds=seconds+GREATEST(0,LEAST($3,EXTRACT(EPOCH FROM now()-heartbeat_at))),heartbeat_at=now(),ended_at=CASE WHEN $4 THEN now() ELSE NULL END WHERE user_id=$1 AND task_id=$2 AND work_type=$5 AND ended_at IS NULL RETURNING *`,[userId,options.taskId,HEARTBEAT_GRACE_SECONDS,options.action==='stop',options.workType]);
    requireCondition(record||options.action==='stop',409,'计时心跳已过期，请重新开始计时');return record||{stopped:true};
  });
}
