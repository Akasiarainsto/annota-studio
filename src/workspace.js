import {RUNTIME_MODE,APP_BASE,runtimeText} from './runtime-config.js';
import {request,post,downloadFile} from './services/api.js';
import {createHistory} from './services/history.js';
import {createTimerControls} from './services/timer.js';
import {importMedia} from './services/import-media.js';
import {renderShell} from './views/shell.js';
import {renderTaskList} from './views/task-list.js';
import {renderWorkbench,renderActionbar,renderChecks} from './views/workbench.js';
import {escapeHtml} from './views/shared.js';
import {showDialog,openReviewDialog,openHistory,openReference} from './views/dialogs.js';
import {openReviewCorrection} from './views/review-corrections.js';
import {renderGuide} from './views/guide.js';
import {mountJsonPage} from './views/json-page.js';
import {mountEvaluation} from './views/evaluation.js';
import {mountProject} from './views/project.js';
import {mountAudioEditor} from './editors/audio-editor.js';
import {mountVideoEditor} from './editors/video-editor.js';
import {mountImageEditor} from './editors/image-editor.js';
import {validateDocument} from './core/validation.js';

// One workspace lifecycle owns route transitions and draft state; modality logic lives in separate editors.
export async function createWorkspace(options) {
  const {root,user,onLogout}=options;
  const state={task:null,document:null,tasks:[],editor:null,dirty:false,issues:[],page:'tasks',review:false,history:createHistory(),toastTimer:0};
  const abort=new AbortController();root.innerHTML=renderShell(user);root.inert=true;root.setAttribute('aria-busy','true');
  const main=root.querySelector('#main'),actionbar=root.querySelector('#actionbar'),saveLabel=root.querySelector('#save-status');
  const draftKey=()=>`${RUNTIME_MODE==='interview'?'annota-interview-draft':'annota-local-v3'}:${user.id}:${state.task?.id}`;
  const toast=message=>{const element=root.querySelector('#toast');element.textContent=message;element.classList.add('visible');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>element.classList.remove('visible'),5000);};
  const onError=error=>{toast(error.message||String(error));if(error.issues?.length){state.issues=error.issues;showChecks();}if(error.status===409){saveLabel.textContent='版本冲突 · 本机草稿保留';showNotice('已保存版本已更新，请先导出本机草稿，或重新载入后比较。',true);}};
  const timer=await createTimerControls({root,getTask:()=>state.page==='workbench'?state.task:null,onError});
  function showNotice(message,conflict=false){const host=root.querySelector('#task-notice');if(host)host.innerHTML=`<div class="notice">${escapeHtml(message)}${conflict?'<button id="download-local-draft">导出本机草稿</button><button id="reload-server-task">载入已保存版本</button>':''}</div>`;}
  function showChecks(){const panel=root.querySelector('#checks-panel');if(panel)panel.innerHTML=renderChecks(state.issues);}
  function refreshHistoryControls(){root.querySelectorAll('[data-history]').forEach(button=>{button.disabled=!state.task?.canEdit||!(button.dataset.history==='undo'?state.history.canUndo:state.history.canRedo);});}
  function setDocument(next,record=true){if(!state.task?.canEdit)return;if(record)state.history.push(state.document);state.document=next;state.dirty=true;saveLabel.textContent='未保存 · 本机草稿已保留';localStorage.setItem(draftKey(),JSON.stringify({version:state.task.version,document:next}));state.issues=validateDocument(next,{media:state.task.media});showChecks();refreshHistoryControls();}
  async function updateTasks(){state.tasks=(await request('/tasks')).tasks;const own=state.tasks.filter(task=>task.assignee===user.id);root.querySelector('#personal-progress').innerHTML=user.role==='annotator'?`<span>已提交 <b>${own.filter(task=>task.round>0).length}/${own.length}</b></span><span>待返工 <b>${own.filter(task=>task.status==='returned').length}</b></span>`:`<span>${user.role==='reviewer'?'独立复核':'项目管理'} · 待处理 <b>${state.tasks.filter(task=>task.canReview||task.canArbitrate||task.canHandleCorrection).length}</b></span>`;}
  async function save(){if(!state.task?.canEdit||!state.dirty)return;saveLabel.textContent='保存中…';try{const task=await request('/tasks/'+state.task.id,{method:'PUT',body:JSON.stringify({version:state.task.version,document:state.document})});state.task=task;state.dirty=false;localStorage.removeItem(draftKey());saveLabel.textContent=runtimeText('已保存至本地服务','已保存到当前浏览器');await updateTasks();}catch(error){saveLabel.textContent='保存失败 · 本机草稿保留';throw error;}}
  async function clearPage(){await timer.stop();if(state.editor)await state.editor.destroy();state.editor=null;main.replaceChildren();actionbar.innerHTML='';}
  function newHost(){const host=document.createElement('div');host.className='route-host';main.append(host);return host;}
  function setNav(page){root.querySelectorAll('[data-nav]').forEach(button=>button.classList.toggle('active',button.dataset.nav===page));}
  async function openTask(id,review=state.review){
    await save();await clearPage();state.task=await request('/tasks/'+id);state.document=structuredClone(state.task.draft);state.dirty=false;state.history=createHistory();state.page='workbench';state.review=review;
    const host=newHost();host.innerHTML=renderWorkbench(state.task,review);actionbar.innerHTML=renderActionbar(state.task);setNav(review?'quality':'tasks');saveLabel.textContent=runtimeText('已载入已保存版本','已载入浏览器演示记录');
    const mount={audio:mountAudioEditor,video:mountVideoEditor,image:mountImageEditor}[state.task.modality];
    state.editor=await mount({root:host.querySelector('#editor-host'),task:state.task,getDocument:()=>state.document,onChange:setDocument,readonly:!state.task.canEdit,onError,toast});
    state.issues=validateDocument(state.document,{media:state.task.media});showChecks();refreshHistoryControls();
    if(state.task.status==='returned')showNotice('本任务已退回。请查看修改与复核记录，修订后重新提交。');
    if(state.task.status==='correction_pending')showNotice('本轮收到复核更正申请，正在等待负责人处理。原结论保留；可在修改与复核记录中查看原因。');
    if(state.task.canWithdrawReview)showNotice('你的意见已提交。若发现误判，可点右下角“撤回复核并修改”；双人结果形成后需申请更正。');
    if(localStorage.getItem(draftKey())&&state.task.canEdit)showNotice('发现这台浏览器保留的未保存草稿。可打开比较后恢复。');
    if(localStorage.getItem(draftKey())&&state.task.canEdit)host.querySelector('#task-notice .notice').insertAdjacentHTML('beforeend','<button id="restore-local-draft">比较并恢复</button>');
    timer.render();await updateTasks();history.replaceState(null,'',`${APP_BASE}?task=${encodeURIComponent(id)}${review?'&mode=quality':''}`);
  }
  async function navigate(page){
    await save();await clearPage();state.page=page;state.review=page==='quality';const host=newHost();setNav(page);timer.render();await updateTasks();
    if(page==='tasks'||page==='quality'){
      host.innerHTML=renderTaskList(state.tasks,{review:page==='quality',user});
      host.addEventListener('click',async event=>{try{
        const filter=event.target.closest('[data-filter]');if(!filter)return;const key=filter.dataset.filter;
        host.querySelectorAll('[data-filter]').forEach(button=>button.classList.toggle('active',button===filter));
        const plan=key==='sample'?await request('/sample'):null;const sampled=plan?.strata.flatMap(stratum=>stratum.selected)||[];
        const stale=sampled.some(item=>state.tasks.find(task=>task.id===item.id)?.round!==item.round);
        host.querySelectorAll('[data-task-row]').forEach(row=>{const snapshot=sampled.find(item=>item.id===row.dataset.taskRow);const task=state.tasks.find(item=>item.id===row.dataset.taskRow);row.hidden=key==='sample'?!snapshot||snapshot.round!==task.round:key!=='all'&&row.dataset.modality!==key;});
        if(key==='sample'&&!plan)toast('负责人尚未生成抽检方案');else if(key==='sample'&&stale)toast('旧轮次样本已从当前队列排除，请负责人重新生成抽检方案');
      }catch(error){onError(error);}});
    }
    if(page==='json')state.editor=await mountJsonPage({root:host,tasks:state.tasks,currentTask:state.task?{...state.task,draft:state.document}:null,onError,toast,onApply:async doc=>{if(!state.task?.canEdit||doc.task_id!==state.task.id||doc.modality!==state.task.modality)throw new Error('仅能应用到当前可编辑的同一任务');if(!doc.media||Object.keys(state.task.media).some(key=>doc.media[key]!==state.task.media[key])||Object.keys(doc.media).length!==Object.keys(state.task.media).length)throw new Error('媒体引用和原片信息不能变更');if(doc.segments)doc.segments.forEach(segment=>segment.boundary_status='pending_listen');if(doc.modality==='image')doc.content_confirmed=false;setDocument(doc);await save();await openTask(state.task.id,false);toast('已应用并保存；请重新完成人工确认');}});
    if(page==='evaluation')state.editor=await mountEvaluation({root:host,tasks:state.tasks,onError,toast});
    if(page==='project')state.editor=await mountProject({root:host,onError,toast});
    if(page==='guide')host.innerHTML=renderGuide();
    if(page!=='workbench')actionbar.innerHTML=runtimeText('<span class="form-hint">Annota · 本地验收版</span><span class="form-hint">独立账号 / 本机存储 / 真实媒体</span>','<span class="form-hint">Annota · 面试演示版</span><span class="form-hint">角色模拟 / 浏览器存储 / 真实媒体</span>');
    history.replaceState(null,'',APP_BASE+'?view='+page);
  }
  function focusIssue(path){
    const index=Number(path.split('/')[2]);const item=state.document.segments?.[index]||state.document.boxes?.[index];if(item)state.editor?.select?.(item.id);
    showChecks();const field=root.querySelector(`[data-field-path="${CSS.escape(path)}"]`);if(field){field.classList.add('field-error');field.scrollIntoView({block:'center',behavior:'smooth'});field.focus();}
  }
  async function submit(){
    await save();state.issues=validateDocument(state.document,{submission:true,media:state.task.media});showChecks();
    if(state.issues.length){focusIssue(state.issues[0].path);toast(`还有 ${state.issues.length} 项待处理，请查看检查结果`);return;}
    const dialog=showDialog(root,'提交当前版本',`<p>任务 <b>${escapeHtml(state.task.id)}</b> · v${state.task.version}</p><p>结构检查通过，${state.document.segments?.length||state.document.boxes?.length} 个片段/区域已人工确认。</p><p class="muted">提交后冻结当前结果，进入独立双人复核。未退回前不能修改。</p>`,'<button id="confirm-submit" class="primary">确认提交质检</button>');
    dialog.querySelector('#confirm-submit').onclick=async event=>{event.target.disabled=true;try{await timer.stop();await post(`/tasks/${state.task.id}/submit`,{version:state.task.version});dialog.close();await openTask(state.task.id,false);toast('已提交，等待两位独立复核员');}catch(error){onError(error);event.target.disabled=false;}};
  }
  async function importFile(){
    const input=document.createElement('input');input.type='file';input.accept='.wav,.mp3,.m4a,.mp4,.webm,.jpg,.jpeg,.png';
    input.onchange=async()=>{try{if(!input.files[0])return;toast('正在读取媒体并保存至本机服务…');const imported=await importMedia(input.files[0]);
      const create=async()=>{const task=await post('/tasks',imported);await updateTasks();await openTask(task.id,false);toast('素材已导入；请手动建立句段或标注区域');};
      if(imported.document.modality==='video'){
        const dialog=showDialog(root,'确认视频帧率','<p>浏览器不能可靠自动读取原片帧率。请填写素材实际帧率，用于帧与时间换算。</p><label>原片帧率 / fps<input id="import-fps" type="number" min="1" max="240" step="0.001" value="24"></label>','<button id="confirm-import-video" class="primary">创建视频任务</button>');
        dialog.querySelector('#confirm-import-video').onclick=async()=>{try{const fps=Number(dialog.querySelector('#import-fps').value);if(!Number.isFinite(fps)||fps<=0||fps>240)throw new Error('请填写 0–240 内的实际正帧率');imported.document.media.fps=fps;imported.document.fps_notice='导入时由用户填写帧率，未自动测量。';dialog.close();await create();}catch(error){onError(error);}};
      }else await create();
    }catch(error){onError(error);}};input.click();
  }
  function restoreDraft(){
    const local=JSON.parse(localStorage.getItem(draftKey()));
    const dialog=showDialog(root,'比较本机草稿与已保存版本',`<p>已保存 v${state.task.version} / 本机草稿基于 v${local.version}。采用本机草稿会替换当前编辑内容，随后仍须保存与确认。</p><label>当前已保存内容<textarea rows="6" readonly>${escapeHtml(JSON.stringify(state.document,null,2))}</textarea></label><label>本机草稿<textarea rows="6" readonly>${escapeHtml(JSON.stringify(local.document,null,2))}</textarea></label>`,'<button id="use-server-draft">保留已保存版本</button><button id="use-local-draft" class="primary">采用本机草稿继续编辑</button>');
    dialog.querySelector('#use-server-draft').onclick=()=>{localStorage.removeItem(draftKey());dialog.close();root.querySelector('#task-notice').innerHTML='';};
    dialog.querySelector('#use-local-draft').onclick=()=>{setDocument(local.document);state.editor.refresh();dialog.close();root.querySelector('#task-notice').innerHTML='';};
  }
  async function handleClick(event){
    const button=event.target.closest('button');if(!button||button.disabled)return;
    try{
      if(button.dataset.nav)await navigate(button.dataset.nav);
      if(button.dataset.openTask)await openTask(button.dataset.openTask,state.page==='quality');
      if(button.dataset.errorPath)focusIssue(button.dataset.errorPath);
      if(button.dataset.history&&state.task?.canEdit){const next=state.history[button.dataset.history](state.document);if(next){setDocument(next,false);state.editor.refresh();}}
      const id=button.id;
      if(id==='back-to-tasks')await navigate(state.review?'quality':'tasks');
      if(id==='save-task'){await save();toast(runtimeText('草稿已保存至本机服务','草稿已保存到当前浏览器'));}
      if(id==='submit-task')await submit();
      if(id==='export-task'||id==='download-local-draft')downloadFile(state.task.id+'.json',JSON.stringify(state.document,null,2));
      if(id==='task-history')openHistory(root,state.task);if(id==='task-reference')openReference(root,state.task);
      if(id==='task-drawer'){const dialog=showDialog(root,'当前批次任务',state.tasks.map(task=>`<button data-drawer-task="${task.id}">${escapeHtml(task.label)}</button>`).join(''));dialog.querySelectorAll('[data-drawer-task]').forEach(item=>item.onclick=async()=>{dialog.close();try{await openTask(item.dataset.drawerTask,false);}catch(error){onError(error);}});}
      if(id==='open-review'||id==='open-arbitration')openReviewDialog({root,task:state.task,onError,onComplete:async()=>{await openTask(state.task.id,true);toast('结论已保存');}},id==='open-arbitration');
      const correctionMode={'withdraw-review':'withdraw','request-review-correction':'request','handle-review-correction':'resolve'}[id];
      if(correctionMode)openReviewCorrection({root,task:state.task,onError,onComplete:async mode=>{await openTask(state.task.id,true);toast(mode==='withdraw'?'意见已撤回，现在可以重新填写':mode==='request'?'更正申请已提交，等待独立负责人处理':'更正处理结果已保存');}},correctionMode);
      if(id==='toggle-checks')root.querySelector('#checks-list').hidden=!root.querySelector('#checks-list').hidden;
      if(id==='previous-task'||id==='next-task'){const index=state.tasks.findIndex(task=>task.id===state.task.id);const next=state.tasks[(index+(id==='next-task'?1:-1)+state.tasks.length)%state.tasks.length];await openTask(next.id,false);}
      if(id==='import-media')await importFile();
      if(id==='restore-local-draft')restoreDraft();
      if(id==='reload-server-task'){state.dirty=false;await openTask(state.task.id,state.review);}
      if(id==='theme-toggle'){const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;localStorage.setItem('annota-local-theme',next);}
      if(id==='account-button'){await save();await timer.destroy();await post('/logout',{});if(state.editor)await state.editor.destroy();abort.abort();await onLogout();}
    }catch(error){onError(error);}
  }
  root.addEventListener('click',handleClick,{signal:abort.signal});
  document.addEventListener('keydown',async event=>{try{
    if(root.querySelector('#dialog').open)return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();await save();return;}
    if(event.target.closest('input,textarea,select,button,[contenteditable=true]'))return;
    if(state.page!=='workbench')return;
    if(event.code==='Space'){event.preventDefault();await state.editor?.play?.();}
    if(event.key==='Enter'){event.preventDefault();await state.editor?.loop?.();}
    if(['[',']'].includes(event.key))state.editor?.nudge?.(event.key==='['?-.01:.01);
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&state.task?.canEdit){event.preventDefault();const next=state.history[event.shiftKey?'redo':'undo'](state.document);if(next){setDocument(next,false);state.editor.refresh();}}
    if(event.altKey&&['ArrowDown','ArrowUp'].includes(event.key)&&state.document.segments?.length){event.preventDefault();const index=state.document.segments.findIndex(segment=>segment.id===state.editor.selected?.id);state.editor.select(state.document.segments[(index+(event.key==='ArrowDown'?1:-1)+state.document.segments.length)%state.document.segments.length].id);}
  }catch(error){onError(error);}},{signal:abort.signal});
  await updateTasks();const query=new URLSearchParams(location.search);
  const requested=query.get('view');const allowed=['tasks','quality','json','evaluation','guide',...(user.role==='manager'?['project']:[])];
  if(query.get('task')&&state.tasks.some(task=>task.id===query.get('task')))await openTask(query.get('task'),query.get('mode')==='quality');else await navigate(allowed.includes(requested)?requested:user.role==='reviewer'?'quality':'tasks');
  root.inert=false;root.setAttribute('aria-busy','false');
  return {destroy:async()=>{abort.abort();clearTimeout(state.toastTimer);await timer.destroy();if(state.editor)await state.editor.destroy();}};
}
