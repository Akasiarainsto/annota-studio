import {randomUUID} from 'node:crypto';
import {query,transaction,selectRows} from './db.js';
import {requireMember,requireAssignee,lockTask,canEditTask,appendEvent} from './access.js';
import {requireCondition,requireText} from './http.js';
import {validateBackup} from '../src/core.js';
import {validateLiveTask} from '../src/json-validation.js';

const ANNOTATION_FIELDS=['caption','tags','segments','regions','tracks','noiseTags'];
const isManager=member=>['owner','manager'].includes(member.role);
function withStatus(row) {return {...row.payload,status:row.status,media:{...row.payload.media,cloudMediaId:row.media_id||undefined}};}
export async function listTasks(userId,projectId) {
  await requireMember(userId,projectId);
  return query('SELECT id,assignee_id,submitted_by,modality,difficulty,status,version,payload->>\'title\' AS title,submission_count,return_count,updated_at FROM annota.tasks WHERE project_id=$1 ORDER BY updated_at DESC LIMIT 1000',[projectId]);
}
export async function readTask(userId,id) {
  const [task]=await query('SELECT * FROM annota.tasks WHERE id=$1',[id]);requireCondition(task,404,'任务不存在');const member=await requireMember(userId,task.project_id);
  return {task:withStatus(task),version:task.version,projectId:task.project_id,assigneeId:task.assignee_id,canEdit:canEditTask(userId,{task,member}),role:member.role};
}
function makeDraft(source,media) {
  const task={id:randomUUID(),modality:source.modality,title:requireText(source.title||media.name,'任务标题',200),split:source.split||'train',caption:'',tags:[],segments:[],regions:[],tracks:[],revision:1,status:'draft',reviews:[],evaluation:{asrOriginal:'',reference:'',ratings:{},outcome:'',notes:''},updatedAt:new Date().toISOString(),isDemo:!!media.stock,media};
  for(const key of ANNOTATION_FIELDS)if(source[key]!==undefined)task[key]=structuredClone(source[key]);
  if(source.evaluation)task.evaluation=structuredClone(source.evaluation);
  const issues=validateBackup({schemaVersion:'annota/1',tasks:[task]});requireCondition(!issues.length,422,issues[0]?.message||'任务结构不合法');return task;
}
export async function createTask(userId,options) {
  const member=await requireMember(userId,options.projectId);requireCondition(isManager(member)||member.role==='annotator',403,'当前角色不能创建标注任务');
  const assignee=options.assigneeId||userId;await requireAssignee(options.projectId,assignee);requireCondition(isManager(member)||assignee===userId,403,'只有管理者可以分配给其他成员');
  let media=options.task.media;
  if(options.mediaId){const [stored]=await query('SELECT * FROM annota.media WHERE id=$1 AND project_id=$2',[options.mediaId,options.projectId]);requireCondition(stored,404,'媒体不属于此项目');media={...media,name:stored.name,url:'',source:'项目成员上传的私有媒体',stock:false};}
  else {const mediaUrl=new URL(media?.url||'', 'https://akasiarainsto.github.io/annota-studio/');requireCondition(mediaUrl.origin==='https://akasiarainsto.github.io'&&mediaUrl.pathname.startsWith('/annota-studio/assets/'),400,'请先上传私有素材，或使用随包模拟素材');media={...media,url:mediaUrl.href,stock:true};}
  const draft=makeDraft(options.task,media);
  const [created]=await query('INSERT INTO annota.tasks(id,project_id,assignee_id,modality,payload,media_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[draft.id,options.projectId,assignee,draft.modality,JSON.stringify(draft),options.mediaId||null]);return readTask(userId,created.id);
}
export async function saveTask(userId,options) {
  return transaction(async client=>{
    const context=await lockTask(client,userId,options.id);const {task}=context;requireCondition(canEditTask(userId,context),403,'只有任务负责人或管理者能编辑');requireCondition(task.version===options.version,409,'任务已被其他设备修改，请重新载入后再合并');
    const candidate=structuredClone(task.payload);for(const key of ANNOTATION_FIELDS)if(options.task[key]!==undefined)candidate[key]=structuredClone(options.task[key]);
    if(options.task.evaluation)candidate.evaluation=structuredClone(options.task.evaluation);
    const changed=ANNOTATION_FIELDS.some(key=>JSON.stringify(candidate[key])!==JSON.stringify(task.payload[key]));
    candidate.revision=task.payload.revision+Number(changed);candidate.status=changed?'draft':task.status;candidate.updatedAt=new Date().toISOString();
    const issues=validateBackup({schemaVersion:'annota/1',tasks:[candidate]});requireCondition(!issues.length,422,issues[0]?.message||'任务结构不合法');
    const [saved]=await selectRows(client,'UPDATE annota.tasks SET payload=$2,status=$3,version=version+1,updated_at=now() WHERE id=$1 RETURNING *',[task.id,JSON.stringify(candidate),candidate.status]);
    if(changed)await appendEvent(client,{taskId:task.id,actorId:userId,kind:'edit',meta:{revision:candidate.revision}});
    return {task:withStatus(saved),version:saved.version};
  });
}
export async function assignTask(userId,options) {
  const [task]=await query('SELECT project_id FROM annota.tasks WHERE id=$1',[options.id]);requireCondition(task,404,'任务不存在');await requireMember(userId,task.project_id,{roles:['owner','manager']});await requireAssignee(task.project_id,options.assigneeId);
  requireCondition(['easy','normal','hard'].includes(options.difficulty),400,'难度不合法');
  const [saved]=await query('UPDATE annota.tasks SET assignee_id=$2,difficulty=$3,version=version+1,updated_at=now() WHERE id=$1 AND version=$4 RETURNING *',[options.id,options.assigneeId,options.difficulty,options.version]);requireCondition(saved,409,'任务版本已变化，请刷新后重试');return {id:saved.id,version:saved.version};
}
export async function submitTask(userId,options) {
  return transaction(async client=>{
    const context=await lockTask(client,userId,options.id);const {task}=context;requireCondition(canEditTask(userId,context),403,'不能提交他人的标注');requireCondition(task.version===options.version,409,'任务已更新，请重新载入');requireCondition(['draft','returned'].includes(task.status),409,'当前状态不能重复提交');
    const issues=validateLiveTask(task.payload);if(issues.length)throw Object.assign(new Error('自动校验未通过，请修正后提交'),{status:422,issues});
    const [saved]=await selectRows(client,`UPDATE annota.tasks SET status='pending',submitted_by=$2,submission_count=submission_count+1,version=version+1,updated_at=now() WHERE id=$1 RETURNING *`,[task.id,userId]);await appendEvent(client,{taskId:task.id,actorId:userId,kind:'submit',meta:{revision:task.payload.revision}});return {task:withStatus(saved),version:saved.version};
  });
}
export async function recordSession(userId,options) {
  return transaction(async client=>{
    const context=await lockTask(client,userId,options.taskId);
    if(options.action!=='stop') {
      if(options.workType==='review'){
        const assignments=await selectRows(client,`SELECT s.id FROM annota.samples s JOIN annota.batches b ON b.id=s.batch_id WHERE s.task_id=$1 AND s.outcome='open' AND (b.reviewer_a=$2 OR b.reviewer_b=$2) AND s.revision=$3 AND s.submission=$4`,[options.taskId,userId,context.task.payload.revision,context.task.submission_count]);
        requireCondition(assignments.length&&['owner','manager','reviewer'].includes(context.member.role)&&context.task.submitted_by!==userId,403,'只有本轮指定复核人可记录复核工时');
      }else requireCondition(canEditTask(userId,context),403,'只有可编辑此任务的成员能记录标注工时');
    }
    if(options.action==='start'){
      const existing=await selectRows(client,'SELECT id,task_id FROM annota.sessions WHERE user_id=$1 AND ended_at IS NULL FOR UPDATE',[userId]);
      if(existing.length){requireCondition(existing[0].task_id===options.taskId,409,'请先暂停其他任务的计时');return existing[0];}
      return (await selectRows(client,'INSERT INTO annota.sessions(user_id,task_id,work_type) VALUES($1,$2,$3) RETURNING *',[userId,options.taskId,options.workType==='review'?'review':'annotation']))[0];
    }
    const statement=options.action==='heartbeat'?`UPDATE annota.sessions SET seconds=seconds+GREATEST(0,LEAST(60,EXTRACT(EPOCH FROM now()-heartbeat_at))),heartbeat_at=now() WHERE user_id=$1 AND task_id=$2 AND ended_at IS NULL RETURNING *`:`UPDATE annota.sessions SET ended_at=now(),seconds=seconds+GREATEST(0,LEAST(60,EXTRACT(EPOCH FROM now()-heartbeat_at))) WHERE user_id=$1 AND task_id=$2 AND ended_at IS NULL RETURNING *`;
    requireCondition(['heartbeat','stop'].includes(options.action),400,'计时动作无效');return (await selectRows(client,statement,[userId,options.taskId]))[0]||{stopped:true};
  });
}
