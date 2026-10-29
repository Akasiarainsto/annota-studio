import {query,selectRows} from './db.js';
import {requireCondition} from './http.js';

export async function ensureUser(identity) {
  const rows=await query(`INSERT INTO annota.users(id,name,email) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=COALESCE(NULLIF($4,''),annota.users.name),email=COALESCE(NULLIF($3,''),annota.users.email) RETURNING *`,[identity.id,identity.name||identity.id.slice(0,8),identity.email||'',identity.name||'']);return rows[0];
}
export async function requireMember(userId,projectId,options={}) {
  const statement='SELECT * FROM annota.members WHERE project_id=$1 AND user_id=$2';
  const [member]=options.client?await selectRows(options.client,statement,[projectId,userId]):await query(statement,[projectId,userId]);
  requireCondition(member&&(!options.roles||options.roles.includes(member.role)),403,'你没有此项目的操作权限');return member;
}
export async function lockTask(client,userId,id) {
  const [task]=await selectRows(client,'SELECT * FROM annota.tasks WHERE id=$1 FOR UPDATE',[id]);requireCondition(task,404,'任务不存在');
  const member=await requireMember(userId,task.project_id,{client});return {task,member};
}
export function canEditTask(userId,{task,member}) {return ['owner','manager'].includes(member.role)||(member.role==='annotator'&&task.assignee_id===userId);}
export async function requireAssignee(projectId,userId) {
  const member=await requireMember(userId,projectId);requireCondition(['owner','manager','annotator'].includes(member.role),400,'任务须分配给可标注的项目成员');
}
export async function appendEvent(client,{taskId,actorId,kind,meta={}}) {await client.query('INSERT INTO annota.events(task_id,actor_id,kind,meta) VALUES($1,$2,$3,$4)',[taskId,actorId,kind,JSON.stringify(meta)]);}
