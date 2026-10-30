import {randomUUID,createHash} from 'node:crypto';
import {query,transaction,selectRows} from './db.js';
import {requireMember} from './access.js';
import {requireText,requireCondition} from './http.js';
import {summarizePeople} from '../src/operations-core.js';

const hashCode=code=>createHash('sha256').update(code).digest('hex');
const MANAGERS=['owner','manager'];
export async function listProjects(userId) {return query('SELECT p.*,m.role FROM annota.projects p JOIN annota.members m ON m.project_id=p.id WHERE m.user_id=$1 ORDER BY p.created_at DESC LIMIT 100',[userId]);}
export async function createProject(userId,title) {
  const name=requireText(title,'项目名称',100);
  return transaction(async client=>{
    const [project]=await selectRows(client,'INSERT INTO annota.projects(title,owner_id) VALUES($1,$2) RETURNING *',[name,userId]);
    await client.query(`INSERT INTO annota.members(project_id,user_id,role) VALUES($1,$2,'owner')`,[project.id,userId]);return {...project,role:'owner'};
  });
}
export async function listMembers(userId,projectId) {
  await requireMember(userId,projectId);return query('SELECT m.*,u.name,u.email FROM annota.members m JOIN annota.users u ON u.id=m.user_id WHERE project_id=$1 ORDER BY m.role,u.name',[projectId]);
}
export async function createInvite(userId,options) {
  await requireMember(userId,options.projectId,{roles:MANAGERS});requireCondition(['manager','annotator','reviewer'].includes(options.role),400,'成员角色无效');
  const code=randomUUID();await query('INSERT INTO annota.invites(code_hash,project_id,role,created_by) VALUES($1,$2,$3,$4)',[hashCode(code),options.projectId,options.role,userId]);return {code,role:options.role,expiresInDays:7};
}
export async function joinProject(userId,code) {
  const normalized=requireText(code,'加入码',100);
  return transaction(async client=>{
    const [invite]=await selectRows(client,'SELECT * FROM annota.invites WHERE code_hash=$1 FOR UPDATE',[hashCode(normalized)]);
    requireCondition(invite&&!invite.used_by&&new Date(invite.expires_at)>new Date(),400,'加入码无效、已使用或已过期');
    const existing=await selectRows(client,'SELECT user_id FROM annota.members WHERE project_id=$1 AND user_id=$2',[invite.project_id,userId]);requireCondition(!existing.length,409,'你已是该项目成员');
    await client.query('INSERT INTO annota.members(project_id,user_id,role) VALUES($1,$2,$3)',[invite.project_id,userId,invite.role]);await client.query('UPDATE annota.invites SET used_by=$2 WHERE code_hash=$1',[hashCode(normalized),userId]);return {projectId:invite.project_id};
  });
}
export async function changeRole(userId,options) {
  await requireMember(userId,options.projectId,{roles:['owner']});requireCondition(['manager','annotator','reviewer'].includes(options.role),400,'成员角色无效');
  const rows=await query(`UPDATE annota.members SET role=$3 WHERE project_id=$1 AND user_id=$2 AND role<>'owner' RETURNING *`,[options.projectId,options.memberId,options.role]);requireCondition(rows.length,400,'不能变更负责人或不存在的成员');return rows[0];
}
export async function getDashboard(userId,options) {
  await requireMember(userId,options.projectId,{roles:MANAGERS});
  const members=await listMembers(userId,options.projectId);
  const tasks=await query(`SELECT id,assignee_id,submitted_by,modality,status,submission_count,return_count FROM annota.tasks WHERE project_id=$1 AND ($2='all' OR modality=$2)`,[options.projectId,options.modality||'all']);
  const sessions=await query(`SELECT s.user_id,s.task_id,s.seconds+CASE WHEN s.ended_at IS NULL THEN GREATEST(0,LEAST(60,EXTRACT(EPOCH FROM now()-s.heartbeat_at))) ELSE 0 END AS seconds,s.work_type FROM annota.sessions s JOIN annota.tasks t ON t.id=s.task_id WHERE t.project_id=$1`,[options.projectId]);
  const events=await query('SELECT e.task_id,e.actor_id,e.kind,e.meta FROM annota.events e JOIN annota.tasks t ON t.id=e.task_id WHERE t.project_id=$1',[options.projectId]);
  const votes=await query('SELECT v.reviewer_id,s.task_id FROM annota.votes v JOIN annota.samples s ON s.id=v.sample_id JOIN annota.tasks t ON t.id=s.task_id WHERE t.project_id=$1',[options.projectId]);
  return {people:summarizePeople({members,tasks,sessions,events,votes}),counts:Object.fromEntries(['draft','pending','approved','returned','disputed'].map(status=>[status,tasks.filter(task=>task.status===status).length])),total:tasks.length};
}
