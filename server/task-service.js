import {randomUUID} from 'node:crypto';
import {query,transaction,selectRows} from './db.js';
import {requireMember,requireAssignee,lockTask,canEditTask,appendEvent} from './access.js';
import {requireCondition,requireText,requireObject} from './http.js';
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
  requireObject(options.task,'task');
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
    requireObject(options.task,'task');
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
