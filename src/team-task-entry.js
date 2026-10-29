import {getTeamSession,teamRequest} from './team-api.js';
import {configureCloudContext} from './cloud-context.js';
import {createCloudTaskStore} from './cloud-task-store.js';
import {createTeamTimer} from './team-timer.js';
import {escapeHtml as esc} from './utils.js';

async function openTask() {
  const session=await getTeamSession();if(!session?.user){location.replace('team.html');return;}
  const id=new URLSearchParams(location.search).get('task');if(!id)throw new Error('没有指定云端任务');
  const initial=await teamRequest(`tasks/${encodeURIComponent(id)}`);let mediaUrl=null;
  if(initial.task.media.cloudMediaId){const blob=await teamRequest(`media/${initial.task.media.cloudMediaId}`,{blob:true});mediaUrl=URL.createObjectURL(blob);initial.task.media.url=mediaUrl;}
  const context=createCloudTaskStore({initial,api:teamRequest,user:session.user});configureCloudContext(context);
  document.querySelector('.brand').href=`team.html?project=${initial.projectId}`;
  document.querySelector('[data-team-link]').href=`team.html?project=${initial.projectId}`;document.querySelector('.version_tag').textContent='TEAM';
  document.querySelector('.queue_footer small').textContent=initial.task.isDemo?'当前素材为模拟样例':'当前素材由项目成员上传';
  document.querySelector('.app_footer>span').innerHTML='<i class="status_dot status_approved"></i>云端项目 <span class="footer_separator">/</span><span id="project-footnote"></span>';
  document.querySelector('.avatar').textContent=session.user.name?.slice(0,1)||'云';document.querySelector('.avatar').title=session.user.name||'当前账号';
  document.querySelectorAll('[data-action="import"],[data-action="backup-import"],[data-action="blank"]').forEach(button=>button.hidden=true);
  document.querySelectorAll('[data-modality]').forEach(button=>button.disabled=button.dataset.modality!==initial.task.modality);
  const bar=document.createElement('div');bar.className='cloud_task_bar';bar.innerHTML=`<a href="team.html?project=${initial.projectId}">返回项目</a><span>云端任务 · ${esc(session.user.name)} · ${initial.canEdit?'可编辑':'只读'}</span><button class="button small" id="cloud-timer-start" ${!initial.canEdit?'disabled':''}>开始作业计时</button><button class="button small" id="cloud-timer-stop" ${!initial.canEdit?'disabled':''}>暂停计时</button><span id="cloud-timer-state">未计时</span><button class="button small" id="cloud-reload">重新载入云端</button>`;document.body.append(bar);
  const status=bar.querySelector('#cloud-timer-state');const timer=createTeamTimer({taskId:id,onUpdate:record=>{status.textContent=record.active?'计时中 · 每 20 秒同步':'计时已暂停';},onError:text=>{status.textContent=text;}});
  bar.querySelector('#cloud-timer-start').addEventListener('click',async()=>{try{await timer.start();}catch(error){status.textContent=error.message;}});bar.querySelector('#cloud-timer-stop').addEventListener('click',async()=>{try{await timer.stop();}catch(error){status.textContent=error.message;}});
  bar.querySelector('#cloud-reload').addEventListener('click',()=>location.reload());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void timer.stop();});window.addEventListener('pagehide',()=>{void timer.stop();if(mediaUrl)URL.revokeObjectURL(mediaUrl);});
  await import('./app.js');
}
try{await openTask();}catch(error){document.querySelector('#workspace').innerHTML=`<div class="notice error">${esc(error.message)} <a href="team.html">返回团队工作区</a></div>`;}
