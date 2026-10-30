import {getTeamSession,authenticateTeam,signOutTeam,teamRequest} from './team-api.js';
import * as views from './team-views.js';
import {SEED_TASKS} from './seed-data.js';
import {probeMedia} from './media-import.js';
import {downloadJson} from './utils.js';
import {createTeamTimer} from './team-timer.js';

const root=document.querySelector('#team-root');
const state={user:null,projects:[],project:null,projectId:new URLSearchParams(location.search).get('project')||'',tab:new URLSearchParams(location.search).get('tab')||'tasks',members:[],tasks:[],batches:[],batch:null,batchId:'',sampleId:'',dashboard:null,dashboardModality:'all',modality:'all',search:'',generation:0,mediaUrl:null,timer:null};
let messageTimer=null;
function message(text) {const element=document.querySelector('#team-message');element.textContent=text;element.hidden=false;clearTimeout(messageTimer);messageTimer=setTimeout(()=>{element.hidden=true;},6000);}
async function releaseSample() {if(state.timer){await state.timer.destroy();state.timer=null;}if(state.mediaUrl){URL.revokeObjectURL(state.mediaUrl);state.mediaUrl=null;}}
async function renderSample() {
  await releaseSample();const sample=state.batch?.samples.find(sample=>sample.id===state.sampleId);const target=root.querySelector('#sample-content');if(!sample||!target)return;
  target.innerHTML=views.sampleView(sample,state);
  const player=target.querySelector('#sample-media');
  if(sample.snapshot.media.cloudMediaId){const blob=await teamRequest(`media/${sample.snapshot.media.cloudMediaId}`,{blob:true});state.mediaUrl=URL.createObjectURL(blob);player.src=state.mediaUrl;}else player.src=sample.snapshot.media.url;
  state.timer=createTeamTimer({taskId:sample.task_id,workType:'review',onUpdate:record=>message(record.active?'复核计时已开始':'复核计时已暂停'),onError:message});
}
async function renderContent() {
  const target=root.querySelector('#team-content');if(!target)return;
  if(state.tab==='tasks')target.innerHTML=views.tasksView(state);
  if(state.tab==='dashboard')target.innerHTML=views.dashboardView(state);
  if(state.tab==='quality'){target.innerHTML=views.qualityView(state);await renderSample();}
}
async function refresh() {
  const generation=++state.generation;const projects=await teamRequest('projects');if(generation!==state.generation)return;
  state.projects=projects;state.project=projects.find(project=>project.id===state.projectId)||projects[0]||null;state.projectId=state.project?.id||'';
  if(!['tasks','quality','dashboard'].includes(state.tab)||(state.tab==='dashboard'&&!['owner','manager'].includes(state.project?.role)))state.tab='tasks';
  if(state.project){
    const [members,tasks,batches]=await Promise.all([teamRequest(`projects/${state.projectId}/members`),teamRequest(`projects/${state.projectId}/tasks`),teamRequest(`projects/${state.projectId}/batches`)]);if(generation!==state.generation)return;
    Object.assign(state,{members,tasks,batches});
    if(state.tab==='dashboard')state.dashboard=await teamRequest(`projects/${state.projectId}/dashboard?modality=${state.dashboardModality}`);
    if(state.tab==='quality'){state.batchId=state.batchId||batches[0]?.id||'';state.batch=state.batchId?await teamRequest(`batches/${state.batchId}`):null;if(!state.batch?.samples.some(sample=>sample.id===state.sampleId))state.sampleId=state.batch?.samples[0]?.id||'';}
  }
  if(generation!==state.generation)return;await releaseSample();root.innerHTML=views.shellView(state);await renderContent();
  if(state.project)history.replaceState(null,'',`?project=${state.projectId}&tab=${state.tab}`);
}
async function addDemo() {
  const modality=root.querySelector('#demo-modality').value;const source=structuredClone(SEED_TASKS.find(task=>task.modality===modality&&(modality==='image'||task.segments.length)));
  source.title=`模拟样例 · ${source.title}`;await teamRequest(`projects/${state.projectId}/tasks`,{method:'POST',body:{task:source}});message('已创建模拟任务；统计将来自实际作业记录。');await refresh();
}
async function uploadFiles(files) {
  for(const file of files){if(file.size>100*1024*1024)throw new Error('单个文件最大 100 MB');message(`正在读取并上传 ${file.name}…`);const metadata=await probeMedia(file);const media=await teamRequest(`projects/${state.projectId}/media?name=${encodeURIComponent(file.name)}`,{method:'POST',body:file,headers:{'Content-Type':file.type||'application/octet-stream'}});await teamRequest(`projects/${state.projectId}/tasks`,{method:'POST',body:{mediaId:media.id,task:{modality:metadata.modality,title:file.name,media:{name:file.name,...metadata}}}});}
  message(`已上传 ${files.length} 个素材并创建云端任务`);await refresh();
}
async function assignTask(id) {
  const task=state.tasks.find(task=>task.id===id);await teamRequest(`tasks/${id}/assignment`,{method:'PATCH',body:{version:task.version,assigneeId:root.querySelector(`[data-task-assignee="${id}"]`).value,difficulty:root.querySelector(`[data-task-difficulty="${id}"]`).value}});message('分配已保存');await refresh();
}
async function createInvite() {
  const role=root.querySelector('#invite-role').value;const invitation=await teamRequest(`projects/${state.projectId}/invites`,{method:'POST',body:{role}});root.querySelector('#team-content').insertAdjacentHTML('afterbegin',views.inviteView(invitation.code,role));
}
async function handleAction(button) {
  const action=button.dataset.teamAction;
  if(action==='auth-mode'){root.innerHTML=views.authView(button.dataset.mode);return;}
  if(action==='refresh')await refresh();
  if(action==='demo')await addDemo();
  if(action==='upload')root.querySelector('#team-upload').click();
  if(action==='assign')await assignTask(button.dataset.id);
  if(action==='invite')await createInvite();
  if(action==='member-role'){await teamRequest(`projects/${state.projectId}/members/${button.dataset.id}`,{method:'PATCH',body:{role:root.querySelector(`[data-member-role="${button.dataset.id}"]`).value}});message('成员角色已更新');await refresh();}
  if(action==='export-batch')downloadJson(`quality_batch_${state.batchId}.json`,{schemaVersion:'annota-qc/1',exportedAt:new Date().toISOString(),...state.batch});
  if(action==='review-timer-start')await state.timer.start();
  if(action==='review-timer-stop')await state.timer.stop();
}
async function handleSubmit(form) {
  const values=Object.fromEntries(new FormData(form));
  if(form.id==='team-auth-form'){const session=await authenticateTeam(values);state.user=session.user;document.querySelector('#team-user').textContent=state.user.name;document.querySelector('#team-signout').hidden=false;await refresh();return;}
  if(form.id==='create-project'){const project=await teamRequest('projects',{method:'POST',body:values});state.projectId=project.id;state.tab='tasks';state.batchId='';}
  if(form.id==='join-project'){const result=await teamRequest('join',{method:'POST',body:values});state.projectId=result.projectId;state.batchId='';}
  if(form.id==='create-batch'){const batch=await teamRequest(`projects/${state.projectId}/batches`,{method:'POST',body:{...values,rate:Number(values.rate)/100}});state.batchId=batch.id;state.sampleId='';message('分层抽检批次已冻结');}
  if(form.id==='sample-vote'||form.id==='sample-arbitrate'){await state.timer?.stop();await teamRequest(`samples/${state.sampleId}/${form.id==='sample-vote'?'vote':'arbitrate'}`,{method:'POST',body:values});message('判断已锁定并保存；服务端按双人结果处理任务状态。');}
  await refresh();
}
async function handleChange(element) {
  if(element.id==='team-project'){state.projectId=element.value;state.batchId='';state.sampleId='';await refresh();}
  if(element.id==='task-modality'){state.modality=element.value;root.querySelector('#team-task-rows').innerHTML=views.refreshTaskRows(state);}
  if(element.id==='dashboard-modality'){state.dashboardModality=element.value;await refresh();}
  if(element.id==='batch-select'){state.batchId=element.value;state.sampleId='';await refresh();}
  if(element.id==='team-upload'&&element.files.length)await uploadFiles([...element.files]);
}
async function guard(operation) {try{await operation();}catch(error){message(error.message);const inline=root.querySelector('#auth-error');if(inline)inline.textContent=error.message;}}
async function submitOnce(form) {
  if(form.dataset.pending)return;form.dataset.pending='true';
  const buttons=[...form.querySelectorAll('button')];for(const button of buttons)button.disabled=true;
  const submit=form.querySelector('[type="submit"]'),label=submit?.textContent;if(submit)submit.textContent='正在处理…';
  try{await handleSubmit(form);}finally{delete form.dataset.pending;for(const button of buttons)button.disabled=false;if(submit)submit.textContent=label;}
}
root.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.teamTab){state.tab=button.dataset.teamTab;void guard(refresh);}else if(button.dataset.teamSample){state.sampleId=button.dataset.teamSample;void guard(renderContent);}else if(button.dataset.teamAction)void guard(()=>handleAction(button));});
root.addEventListener('submit',event=>{event.preventDefault();if(event.target.reportValidity())void guard(()=>submitOnce(event.target));});
root.addEventListener('change',event=>void guard(()=>handleChange(event.target)));
root.addEventListener('input',event=>{if(event.target.form)event.target.form.dataset.dirty='true';if(event.target.id==='task-search-team'){state.search=event.target.value;root.querySelector('#team-task-rows').innerHTML=views.refreshTaskRows(state);}});
root.addEventListener('change',event=>{if(event.target.form)event.target.form.dataset.dirty='true';});
document.querySelector('#team-signout').addEventListener('click',()=>void guard(async()=>{await releaseSample();await signOutTeam();location.reload();}));
document.addEventListener('visibilitychange',()=>{if(document.hidden)void guard(()=>state.timer?.stop());});
window.addEventListener('pagehide',()=>void guard(()=>state.timer?.stop()));
setInterval(()=>{if(state.user&&state.project&&!state.timer?.active&&!document.hidden&&!document.activeElement?.matches('input,textarea,select')&&!root.querySelector('form[data-dirty="true"],form[data-pending]'))void guard(refresh);},15000);
await guard(async()=>{try{const session=await getTeamSession();if(!session?.user){root.innerHTML=views.authView();return;}state.user=session.user;document.querySelector('#team-user').textContent=session.user.name;document.querySelector('#team-signout').hidden=false;await refresh();}catch(error){root.innerHTML=views.authView();throw error;}});
