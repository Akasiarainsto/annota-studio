import {SEED_TASKS,PROJECTS,VIDEO_FIELDS} from './seed-data.js';
import {validateBackup,markEdited,STATUS_LABELS} from './core.js';
import {loadTasks,persistTasks,storeMedia,readMedia} from './storage.js';
import {icon,hydrateIcons} from './icons.js';
import {escapeHtml as esc,createId,downloadJson,formatTime,clamp} from './utils.js';
import * as views from './views.js';
import {mountMedia} from './media.js';
import {openJsonValidator} from './json-validator.js';
import {createAnnotationDocument} from './validation-adapters.js';
import {validateLiveTask} from './json-validation.js';
import {startReview,applyReviewDecision,upgradeReviewTask,REVIEW_LABELS} from './review-workflow.js';
import {mountVideoComparison} from './video-comparison.js';
import {getCloudContext} from './cloud-context.js';
import {readAudioPeaks} from './media-import.js';
import {createClipWorkflow} from './clip-workflow.js';

const STORAGE_KEY='annota_studio_v1';
const MAX_UNDO=40;
const loaded=loadTasks(SEED_TASKS);
const cloud=getCloudContext();
const state={tasks:loaded.tasks,phase:'annotation',modality:'audio',taskId:'DOL-001',segmentId:'seg_meeting_1',regionId:null,trackId:null,tool:'select',inspectorTab:'annotation',query:'',filter:'all',zoom:1,blocked:loaded.blocked,undo:[],loop:false};
const workspace=document.querySelector('#workspace');
let mediaController=null;
let saveTimer=null;
let editVersion=0;
let savedVersion=0;
let toastTimer=null;
let relinkId=null;
let renderToken=0;
const objectUrls=new Map();
const clips=createClipWorkflow({getTask:currentTask,getSegment:selectedSegment,getTime:()=>mediaController?.currentTime||0,addSegment,seek:time=>mediaController?.seek(time),notify,showModal,readMedia});

function currentTask() {return state.tasks.find(task=>task.id===state.taskId);}
function selectedSegment() {return currentTask().segments.find(segment=>segment.id===state.segmentId);}
function selectedObject() {
  const task=currentTask();
  return task.modality==='video'?task.tracks.find(track=>track.id===state.trackId):task.regions.find(region=>region.id===state.regionId);
}
function notify(message) {
  const toast=document.querySelector('#toast');
  toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove('show'),4200);
}
function showModal(title,body,actions='') {
  document.querySelector('#modal-title').textContent=title;
  document.querySelector('#modal-body').innerHTML=body;
  document.querySelector('#modal-actions').innerHTML=actions || '<button class="button primary" data-action="close-modal">知道了</button>';
  document.querySelector('#modal').showModal();
}
async function saveTasks(options={}) {
  clearTimeout(saveTimer);
  const versionToSave=editVersion;
  if(state.blocked) {if(!options.quiet) notify('草稿保护已开启，请先导出备份或在帮助中重建存储。');return false;}
  try {
    if(cloud&&!cloud.canEdit){if(!options.quiet)notify('此云端任务为只读');return false;}
    await persistTasks(state.tasks);
    savedVersion=Math.max(savedVersion,versionToSave);
    document.querySelector('#save-indicator').textContent=cloud?(cloud.pending?'云端同步中…':'已保存到云端'):'草稿已存本机';
    if(!options.quiet)notify(cloud?'标注已保存在云端':'草稿已保存在当前浏览器');return true;
  } catch(error) {
    document.querySelector('#save-indicator').textContent='保存失败 · 请导出备份';
    notify(`保存失败，当前编辑仍在内存中：${error.message}`);return false;
  }
}
function rememberTask() {
  state.undo.push(structuredClone(currentTask()));
  if(state.undo.length>MAX_UNDO)state.undo.shift();
}
function changedTask(options={}) {
  editVersion++;
  Object.assign(currentTask(),markEdited(currentTask()));
  document.querySelector('#save-indicator').textContent='正在保存…';
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveTasks({quiet:true}),450);
  if(options.render!==false){renderTasks();refreshInspector();refreshSegments();mediaController?.repaint();}
  refreshHeading();
  refreshLiveValidation();
}
function refreshHeading() {
  const heading=workspace.querySelector('.workspace_heading');
  if(heading)heading.outerHTML=views.heading(currentTask(),state.phase);
}
function renderTasks() {
  document.querySelectorAll('[data-modality]').forEach(button=>button.classList.toggle('active',button.dataset.modality===state.modality));
  const tasks=state.tasks.filter(task=>task.modality===state.modality&&(state.filter==='all'||task.status===state.filter)&&`${task.id} ${task.title}`.toLowerCase().includes(state.query.toLowerCase()));
  document.querySelector('#task-list').innerHTML=tasks.map(task=>views.taskCard(task,task.id===state.taskId)).join('') || '<div class="empty_state">没有匹配的任务。调整搜索或状态筛选。</div>';
  document.querySelector('#queue-count').textContent=`任务队列 · ${tasks.length}`;
  document.querySelector('#project-footnote').textContent=`${PROJECTS[state.modality].name} · ${PROJECTS[state.modality].description}`;
}
function refreshClipControls(task) {
  const exportButton=workspace.querySelector('[data-action="export-clip"]');if(exportButton)exportButton.disabled=!selectedSegment();
  const quickButton=workspace.querySelector('[data-action="quick-clip"]');if(quickButton)quickButton.disabled=task.media.duration<3;
  for(const option of workspace.querySelectorAll('#clip-duration option'))option.disabled=Number(option.value)>task.media.duration;
}
function refreshSegments() {
  const task=currentTask();refreshClipControls(task);
  const list=document.querySelector('#segment-list');
  if(list)list.innerHTML=views.segmentRows(task,state,state.phase==='annotation'&&(!cloud||cloud.canEdit));
  const lane=document.querySelector('#segment-lane');
  if(lane)lane.innerHTML=task.segments.map((segment,index)=>`<button class="segment_chip ${segment.id===state.segmentId?'active':''}" data-segment="${esc(segment.id)}">${String(index+1).padStart(2,'0')} ${esc(segment.speaker || segment.label || '片段')}</button>`).join('');
}
function refreshInspector() {
  const element=workspace.querySelector('.inspector');
  if(element)element.innerHTML=cloud&&(state.phase==='review'||!cloud.canEdit)?views.cloudReviewPanel(currentTask(),cloud):state.phase==='review'?views.reviewPanel(currentTask(),validateLiveTask(currentTask())):views.inspector(currentTask(),state);
  refreshLiveValidation();
}
function refreshLiveValidation() {
  const element=workspace.querySelector('#live-validation');if(!element)return;
  const open=element.querySelector('details')?.open;
  const issues=validateLiveTask(currentTask());
  element.className=`live_validation ${issues.length?'has_issues':'is_valid'}`;
  element.innerHTML=issues.length?`<details ${open?'open':''}><summary>即时校验 · ${issues.length} 项待修正</summary><div class="live_issue_list">${issues.map(issue=>`<button data-issue="${esc(issue.field)}">${esc(issue.message)}<small>${esc(issue.field)}</small></button>`).join('')}</div></details>`:'<span>✓ 即时规则通过 · 可提交质检</span>';
}
async function ensureMedia(task) {
  if(!task.media.imported || task.media.url)return;
  try {
    const blob=await readMedia(task.media.blobKey || task.id);
    if(blob){const url=URL.createObjectURL(blob);objectUrls.set(task.id,url);task.media.url=url;}
  } catch(error) {notify(`本地媒体暂不可读：${error.message}。可重新关联素材。`);}
}
function normaliseSelection() {
  const task=currentTask();
  if(!task.segments.some(segment=>segment.id===state.segmentId))state.segmentId=task.segments[0]?.id || null;
  if(!task.regions.some(region=>region.id===state.regionId))state.regionId=task.regions[0]?.id || null;
  if(!task.tracks.some(track=>track.id===state.trackId))state.trackId=null;
}
async function renderWorkspace() {
  const token=++renderToken;
  if(clips.active)clips.cancel();
  mediaController?.destroy();mediaController=null;
  const task=currentTask();await ensureMedia(task);if(token!==renderToken)return;
  normaliseSelection();
  document.querySelectorAll('[data-phase]').forEach(button=>button.classList.toggle('active',button.dataset.phase===state.phase));
  const editable=state.phase==='annotation'&&(!cloud||cloud.canEdit);
  const media=task.media.url?views.mediaPanel(task,editable,state):'<section class="media_panel"><div class="empty_state">此浏览器中没有关联的媒体文件。<br><button class="button primary" data-action="relink">重新关联素材</button></div></section>';
  const hint=task.modality==='image'?'框选记录目标位置，Caption 记录整体内容。':task.modality==='audio'?'选择片段 → 试听 → 转写与属性 → 提交质检。':'选择片段 → 七项描述；目标轨迹单独记录关键帧。';
  const left=`<div class="media_column">${media}${views.timeline(task,editable)}${views.segmentsPanel(task,state,editable)}<p class="workflow_hint">${icon('info')} ${hint}</p></div>`;
  const right=`<aside class="inspector">${editable?views.inspector(task,state):cloud?views.cloudReviewPanel(task,cloud):views.reviewPanel(task,validateLiveTask(task))}</aside>`;
  workspace.innerHTML=views.heading(task,state.phase)+(state.phase==='evaluation'?renderEvaluation(task,media):`<div class="workbench_grid">${left}${right}</div>`);
  mediaController=workspace.querySelector('[data-pair-video]')?mountVideoComparison({root:workspace,onError:notify}):mountMedia(mediaOptions(task,editable));
  refreshSegments();renderTasks();refreshLiveValidation();
  if(cloud&&!cloud.canEdit)workspace.querySelectorAll('[data-bind],.heading_actions [data-action="save"],.heading_actions [data-action="submit"]').forEach(control=>control.disabled=true);
}
function renderEvaluation(task,media) {
  if(task.modality!=='audio')return `<div class="evaluation_layout">${views.evaluationPanel(task)}</div>`;
  return `<div class="evaluation_layout">${media}${views.timeline(task,false)}${views.evaluationPanel(task)}</div>`;
}
function mediaOptions(task,editable) {
  return {root:workspace,task,editable,getSelection:()=>state,
    onSelectSegment:selectSegment,onSelectRegion:selectObject,
    onCreateSegment:addSegment,onCreateRegion:createRegion,onMoveRegion:moveRegion,
    onCreateKeyframe:createKeyframe,onTimeChange:()=>{},
    onDuration:metadata=>{Object.assign(task.media,metadata);refreshClipControls(task);},onError:notify};
}
function selectSegment(id) {
  state.segmentId=id;refreshSegments();if(state.phase==='annotation')refreshInspector();
  const segment=selectedSegment();if(segment)mediaController?.seek(segment.start);
  mediaController?.repaint();
}
function selectObject(id) {
  if(currentTask().modality==='video')state.trackId=id;else state.regionId=id;
  state.inspectorTab='objects';refreshInspector();mediaController?.repaint();
}
function addSegment(options={}) {
  if(state.phase!=='annotation')return;
  const task=currentTask();rememberTask();
  const start=options.start ?? mediaController?.currentTime ?? 0;
  const end=options.end ?? Math.min(task.media.duration,start+Math.min(2,task.media.duration));
  if(end-start<0.05){notify('播放位置已接近末尾，请先向前定位。');state.undo.pop();return;}
  const segment={id:createId('seg'),start:Number(start.toFixed(3)),end:Number(end.toFixed(3)),label:task.modality==='audio'?'Speech':'事件',text:'',speaker:'说话人 1',language:'普通话',dialect:'',scene:'',mixed:false};
  if(task.modality==='video')segment.description=Object.fromEntries(Object.keys(VIDEO_FIELDS).map(key=>[key,'']));
  task.segments.push(segment);task.segments.sort((a,b)=>a.start-b.start);state.segmentId=segment.id;state.inspectorTab='annotation';changedTask();
}
function createRegion(box) {
  rememberTask();const region={id:createId('region'),label:PROJECTS.image.labels[0],...box};
  currentTask().regions.push(region);state.regionId=region.id;state.inspectorTab='objects';changedTask();
}
function moveRegion(box) {
  const region=currentTask().regions.find(region=>region.id===box.id);if(!region)return;
  rememberTask();Object.assign(region,box);changedTask();
}
function createKeyframe(box) {
  rememberTask();const task=currentTask();let track=selectedObject();
  if(!track){track={id:createId('track'),label:'小球',keyframes:[]};task.tracks.push(track);state.trackId=track.id;}
  const frame={...box,time:Number(box.time.toFixed(3))};
  const existing=track.keyframes.findIndex(item=>Math.abs(item.time-frame.time)<0.04);
  if(existing>=0)track.keyframes.splice(existing,1,frame);else track.keyframes.push(frame);
  track.keyframes.sort((a,b)=>a.time-b.time);state.inspectorTab='objects';changedTask();
}
function updateInput(element) {
  const bind=element.dataset.bind;if(!bind)return;
  const task=currentTask();const [scope,key]=bind.split('.');
  const value=element.type==='checkbox'?element.checked:element.type==='number'?Number(element.value):element.value;
  if(['evaluation','rating'].includes(scope)) {
    editVersion++;
    if(scope==='rating')task.evaluation.ratings[key]=value===''||value==='na'?value:Number(value);
    else task.evaluation[key]=value;
    clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveTasks({quiet:true}),450);return;
  }
  rememberTask();
  if(scope==='segment'&&selectedSegment())selectedSegment()[key]=value;
  if(scope==='description'&&selectedSegment())selectedSegment().description[key]=value;
  if(scope==='task')task[key]=value;
  if(scope==='object'&&selectedObject())selectedObject()[key]=value;
  changedTask({render:false});refreshSegments();mediaController?.repaint();renderTasks();
}
async function submitTask() {
  const issues=validateLiveTask(currentTask());
  if(issues.length){showModal('提交前，请完成这些标注',`<div class="issue_list">${issues.map(issue=>`<button class="issue_item" data-issue="${esc(issue.field)}">${esc(issue.message)}<small>${esc(issue.field)}</small></button>`).join('')}</div>`);return;}
  if(cloud){if(!await saveTasks({quiet:true}))return;try{await cloud.submit();renderTasks();refreshHeading();refreshInspector();notify('已通过服务端校验并提交，请由管理者创建分层抽检批次。');}catch(error){notify(error.message);}return;}
  const result=startReview(currentTask());if(!result.ok){notify(result.message);return;}
  Object.assign(currentTask(),result.task);saveTasks({quiet:true});renderTasks();refreshHeading();notify('已开启新复核周期。请在“数据质检”由两位不同姓名分别填写意见。');
}
function reviewTask(decision) {
  if(cloud){notify('云端独立复核请进入项目的分层抽检队列。');return;}
  const task=currentTask();
  const note=document.querySelector('#review-note')?.value.trim() || '';
  if(decision==='approved') {
    if(validateLiveTask(task).length){notify('结构检查尚未通过，请退回标注修正。');return;}
    const media=workspace.querySelector('#media-player,#visual-media');
    if(!media||(task.modality==='image'?!media.naturalWidth:media.readyState<2)){notify('请先载入可核对的媒体素材，再记录通过意见。');return;}
  }
  const result=applyReviewDecision(task,{decision,note,reviewer:document.querySelector('#reviewer')?.value||'',checksConfirmed:document.querySelectorAll('[data-review-check]:checked').length===3,id:createId('review'),at:new Date().toISOString()});
  if(!result.ok){notify(result.message);return;}
  Object.assign(task,result.task);saveTasks({quiet:true});renderTasks();refreshHeading();refreshInspector();
  const recorded=task.reviews.at(-1);notify(recorded.decision==='opinion'?'已记录首轮意见，任务仍待质检；请由另一位复核人确认。':`已记录：${REVIEW_LABELS[recorded.decision]}`);
}
function locateIssue(path) {
  document.querySelector('#modal').close();state.phase='annotation';
  const match=path.match(/^segments\.(\d+)/);if(match)state.segmentId=currentTask().segments[Number(match[1])]?.id;
  state.inspectorTab=path.startsWith('regions')||path.startsWith('tracks')?'objects':'annotation';
  renderWorkspace().then(()=>{const field=path.includes('description.')?`description.${path.split('.').at(-1)}`:match?`segment.${path.split('.').at(-1)}`:`task.${path}`;document.querySelector(`[data-bind="${field}"]`)?.focus();if(path==='noiseTags')document.querySelector('[data-noise-tag]')?.focus();});
}
function exportCurrent() {
  downloadJson(`${currentTask().id}_annotation.json`,{...createAnnotationDocument(currentTask()),exportedAt:new Date().toISOString()});
  notify('已导出当前标注；未混入模型评测记录。');
}
function exportBackup() {
  const tasks=structuredClone(state.tasks);tasks.forEach(task=>{if(task.media.imported)task.media.url='';});
  downloadJson('annota_workspace_backup.json',{schemaVersion:'annota/1',exportedAt:new Date().toISOString(),tasks});
}
function exportEvaluation() {
  const task=currentTask();
  if(Object.values(task.evaluation.ratings).includes('na')&&!task.evaluation.comment?.trim()){notify('存在 N/A 评分，请先在判断证据中说明理由。');return;}
  downloadJson(`${task.id}_evaluation.json`,{schemaVersion:'annota/1',kind:'evaluation',taskId:task.id,isDemo:task.isDemo,evaluation:task.evaluation,exportedAt:new Date().toISOString()});
}
function blankPractice() {
  const task=structuredClone(currentTask());task.id=createId(`${PROJECTS[task.modality].name.toLowerCase()}_practice`);
  task.title=`空白练习 · ${task.media.name}`;task.caption='';task.tags=[];task.segments=[];task.regions=[];task.tracks=[];task.reviews=[];task.reviewRound=0;task.revision=1;task.status='draft';task.updatedAt=new Date().toISOString();
  task.evaluation={asrOriginal:'',reference:'',ratings:{},outcome:'',notes:''};
  state.tasks.unshift(task);state.taskId=task.id;state.undo=[];saveTasks({quiet:true});renderWorkspace();notify('已创建独立空白练习，原任务保留。');
}
function makeImportedTask(file,modality) {
  const id=createId('local');const url=URL.createObjectURL(file);objectUrls.set(id,url);
  return {id,modality,title:file.name,split:'train',caption:'',tags:[],segments:[],regions:[],tracks:[],revision:1,status:'draft',reviews:[],evaluation:{asrOriginal:'',reference:'',ratings:{},outcome:'',notes:''},updatedAt:new Date().toISOString(),isDemo:true,media:{name:file.name,url,blobKey:id,source:'用户本地导入；任务用于本地演示，不自动获得训练用途授权',duration:0,width:0,height:0,imported:true}};
}
async function importMedia(files) {
  for(const file of files) {
    const modality=file.type.split('/')[0];if(!['audio','video','image'].includes(modality)){notify(`无法识别媒体类型：${file.name}`);continue;}
    let task=relinkId?state.tasks.find(task=>task.id===relinkId):null;
    if(task&&task.modality!==modality){notify('重新关联的媒体类型与任务不一致。');continue;}
    if(task){task.media.url=URL.createObjectURL(file);task.media.blobKey=task.id;task.media.imported=true;objectUrls.set(task.id,task.media.url);}
    else{task=makeImportedTask(file,modality);state.tasks.unshift(task);}
    try{await storeMedia(task.media.blobKey,file);}catch(error){notify(`媒体只能在当前会话使用，请保留原文件：${error.message}`);}
    if(modality==='audio'){try{task.media.peaks=await readAudioPeaks(file);}catch(error){task.media.peaks=[];notify(`音频可尝试播放，但波形解码失败：${error.message}`);}}
    state.taskId=task.id;state.modality=modality;
  }
  relinkId=null;state.phase='annotation';state.undo=[];saveTasks({quiet:true});await renderWorkspace();
}
async function restoreBackup(file) {
  try {
    const backup=JSON.parse(await file.text());const issues=validateBackup(backup);
    if(issues.length){showModal('备份未通过检查',`<p>现有任务未更改。</p>${issues.slice(0,20).map(issue=>`<div class="notice error">${esc(issue.field)}：${esc(issue.message)}</div>`).join('')}`);return;}
    const knownUrls=new Set(SEED_TASKS.flatMap(task=>[task.media.url,task.evaluation.comparisonUrl].filter(Boolean)));
    for(const task of backup.tasks) {
      if(state.tasks.some(existing=>existing.id===task.id)){task.id=createId('restored');task.title=`恢复副本 · ${task.title}`;}
      if(!knownUrls.has(task.media.url)){task.media.url='';task.media.imported=true;}
      if(!knownUrls.has(task.evaluation.comparisonUrl))delete task.evaluation.comparisonUrl;
      state.tasks.push(upgradeReviewTask(task));
    }
    saveTasks({quiet:true});renderTasks();notify(`已恢复 ${backup.tasks.length} 个任务，重名任务保留为副本。`);
  } catch(error){notify(`恢复失败，现有任务未更改：${error.message}`);}
}
function showTaskInfo() {
  const task=currentTask();
  showModal('素材与标注规范',`<div class="notice">${esc(task.media.source)}</div><div class="help_grid"><div><h3>项目场景</h3><p>${PROJECTS[task.modality].name} · ${PROJECTS[task.modality].description}</p></div><div><h3>任务身份</h3><p class="mono">${esc(task.id)} / r${task.revision}</p></div><div><h3>数据划分</h3><p>${esc(task.split)} · 本地演示</p></div><div><h3>真实媒体信息</h3><p>${task.modality==='image'?`${task.media.width} × ${task.media.height}`:formatTime(task.media.duration)}</p></div></div><div class="form_section"><h3>完成标准</h3><p>${task.modality==='audio'?'试听每个片段，核对起止时间、逐句转写、说话人和语种。噪声与语音分开。':task.modality==='video'?'片段边界清楚，七项 Dense Caption 均有观察；框轨迹只在已定义的关键帧范围内插值。':'Caption 只写图中可见内容；标签贴切；目标框紧贴目标，坐标保持在图内。'}</p></div>`);
}
function showHelp() {
  const protection=state.blocked?'<div class="notice error">原有草稿损坏，已停止自动覆盖。可先导出当前备份，再重建存储。</div><button class="button danger" data-action="reset-storage">重建当前浏览器草稿</button>':'';
  showModal('把注意力留给标注',`<div class="help_grid"><div><h3>数据标注</h3><p>记录素材里有什么。音频写转写，视频写片段描述，图片写 Caption 和目标框。</p></div><div><h3>数据质检</h3><p>先检查结构，再由两名不同姓名分别填写意见；可退回、提交分歧或仲裁。</p></div><div><h3>模型评测</h3><p>只检查模型原始输出。ASR 原稿和人工修订稿分开。</p></div><div><h3>本地与来源</h3><p>预置数据为模拟。导入媒体存本浏览器，备份仅含标注和元数据；跨设备恢复需重新关联媒体。</p></div></div><div class="form_section"><h3>快捷键</h3><p>空格 播放/暂停 · [ 取起点 · ] 取终点 · V 选择 · B 框选 · Ctrl S 保存 · Ctrl Z 撤销 · Delete 删除当前对象</p></div><div class="inline_notice" style="margin-top:18px">JSON 通过只表示符合所检查的结构/时间/坐标规则，不能证明内容准确或模型表现好。本演示不调用模型服务。</div>${protection}`);
}
function showExport() {
  if(cloud){showModal('导出当前任务','云端项目与复核记录保存在服务端；这里分别导出当前人工标注与模型评测。','<button class="button" data-action="export-current">当前标注 JSON</button><button class="button" data-action="export-evaluation">当前评测 JSON</button>');return;}
  showModal('导出工作成果','<p>标注和模型评测分别导出，工作区备份保留全部记录。</p><div class="notice" style="margin-top:16px">备份 JSON 不包含媒体二进制文件。请保留原始音频、视频与图片。</div>','<button class="button" data-action="export-current">当前标注 JSON</button><button class="button" data-action="export-evaluation">当前评测 JSON</button><button class="button primary" data-action="export-backup">全部工作区备份</button>');
}
function undoTask() {
  const previous=state.undo.pop();if(!previous){notify('没有可撤销的标注操作。');return;}
  const task=currentTask();const evaluation=task.evaluation;
  const revision=task.revision+1;const reviews=task.reviews;const reviewRound=task.reviewRound;
  Object.assign(task,previous,{evaluation,reviews,reviewRound,revision,status:'draft',updatedAt:new Date().toISOString()});
  normaliseSelection();saveTasks({quiet:true});renderTasks();refreshHeading();refreshInspector();refreshSegments();mediaController?.repaint();
}
function setBoundary(key) {
  if(!selectedSegment())return;rememberTask();selectedSegment()[key]=Number((mediaController?.currentTime || 0).toFixed(3));changedTask();
}
function deleteObject() {
  const task=currentTask();rememberTask();
  if(task.modality==='video'){task.tracks=task.tracks.filter(track=>track.id!==state.trackId);state.trackId=null;}
  else {task.regions=task.regions.filter(region=>region.id!==state.regionId);state.regionId=null;}
  changedTask();
}
function setTool(tool) {
  state.tool=tool;workspace.querySelectorAll('[data-action^="tool-"]').forEach(button=>button.classList.toggle('active',button.dataset.action===`tool-${tool}`));
  const overlay=document.querySelector('#annotation-overlay');if(overlay)overlay.style.cursor=tool==='box'?'crosshair':'default';
}
function zoomImage(delta) {
  state.zoom=delta===0?1:clamp(state.zoom+delta,0.5,3);
  const surface=document.querySelector('#visual-surface');if(surface)surface.style.transform=`scale(${state.zoom})`;
  const label=document.querySelector('#zoom-level');if(label)label.textContent=`${Math.round(state.zoom*100)}%`;
}
const ACTIONS={
  'quick-clip':()=>clips.quickClip(),'export-clip':()=>clips.exportClip(),'clip-source':()=>clips.chooseFile(),'cancel-clip':()=>clips.cancel(),
  'json-validate':()=>openJsonValidator({getCurrentTask:currentTask,seedTasks:SEED_TASKS,notify}),
  save:()=>saveTasks(),submit:submitTask,approve:()=>reviewTask('approved'),return:()=>reviewTask('returned'),dispute:()=>reviewTask('disputed'),
  import:()=>{relinkId=null;document.querySelector('#media-import').click();},
  relink:()=>{relinkId=state.taskId;document.querySelector('#media-import').click();},
  'backup-import':()=>document.querySelector('#backup-import').click(),export:showExport,'export-current':exportCurrent,'export-backup':exportBackup,'export-evaluation':exportEvaluation,
  help:showHelp,'task-info':showTaskInfo,'close-modal':()=>document.querySelector('#modal').close(),
  workspace:()=>{state.phase='annotation';renderWorkspace();},'back-to-annotation':()=>{state.phase='annotation';renderWorkspace();},
  blank:blankPractice,'add-segment':()=>addSegment(),play:()=>mediaController?.playPause(),loop:()=>{state.loop=!state.loop;mediaController?.setLoop(state.loop);const button=document.querySelector('#loop-toggle');button?.classList.toggle('active',state.loop);button?.setAttribute('aria-pressed',String(state.loop));},
  'previous-frame':()=>mediaController?.nudge(-1/30),'next-frame':()=>mediaController?.nudge(1/30),
  'set-start':()=>setBoundary('start'),'set-end':()=>setBoundary('end'),'tool-select':()=>setTool('select'),'tool-box':()=>setTool('box'),
  'zoom-in':()=>zoomImage(.25),'zoom-out':()=>zoomImage(-.25),fit:()=>zoomImage(0),undo:undoTask,'delete-object':deleteObject,
  'new-track':()=>{state.trackId=null;setTool('box');refreshInspector();notify('已准备创建新轨迹，请在画面上框选新目标。');},
  'reset-storage':()=>{state.blocked=false;localStorage.removeItem(STORAGE_KEY);saveTasks();document.querySelector('#modal').close();}
};
function handleClick(event) {
  const target=event.target.closest('button,[data-segment]');if(!target)return;
  if(target.dataset.action){ACTIONS[target.dataset.action]?.();return;}
  if(target.dataset.phase){state.phase=target.dataset.phase;renderWorkspace();return;}
  if(target.dataset.modality){switchModality(target.dataset.modality);return;}
  if(target.dataset.task){switchTask(target.dataset.task);return;}
  if(target.dataset.playSegment){mediaController?.playSegment(target.dataset.playSegment);return;}
  if(target.dataset.deleteSegment){rememberTask();currentTask().segments=currentTask().segments.filter(segment=>segment.id!==target.dataset.deleteSegment);normaliseSelection();changedTask();return;}
  if(target.dataset.segment){selectSegment(target.dataset.segment);return;}
  if(target.dataset.inspectorTab){state.inspectorTab=target.dataset.inspectorTab;refreshInspector();return;}
  if(target.dataset.object){selectObject(target.dataset.object);return;}
  if(target.dataset.tag){rememberTask();const tags=currentTask().tags;const index=tags.indexOf(target.dataset.tag);if(index>=0)tags.splice(index,1);else tags.push(target.dataset.tag);changedTask();return;}
  if(target.dataset.noiseTag){rememberTask();const task=currentTask();task.noiseTags??=[];const index=task.noiseTags.indexOf(target.dataset.noiseTag);if(index>=0)task.noiseTags.splice(index,1);else task.noiseTags.push(target.dataset.noiseTag);changedTask();return;}
  if(target.dataset.seek){mediaController?.seek(Number(target.dataset.seek));return;}
  if(target.dataset.deleteKeyframe){rememberTask();selectedObject().keyframes=selectedObject().keyframes.filter(frame=>frame.time!==Number(target.dataset.deleteKeyframe));changedTask();return;}
  if(target.dataset.issue)locateIssue(target.dataset.issue);
}
function switchTask(id) {
  state.taskId=id;state.undo=[];state.tool='select';state.inspectorTab='annotation';state.zoom=1;state.loop=false;renderWorkspace();
}
function switchModality(modality) {
  state.modality=modality;state.query='';state.filter='all';document.querySelector('#task-search').value='';document.querySelector('#status-filter').value='all';
  switchTask(state.tasks.find(task=>task.modality===modality).id);
}
function handleKey(event) {
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();saveTasks();return;}
  if(event.target.closest('input,textarea,select')||document.querySelector('#modal').open)return;
  if(event.code==='Space'){event.preventDefault();mediaController?.playPause();}
  if(event.key==='?')showHelp();
  if(state.phase!=='annotation')return;
  if(cloud&&!cloud.canEdit)return;
  if(event.key.toLowerCase()==='b')setTool('box');
  if(event.key.toLowerCase()==='v')setTool('select');
  if(event.key==='[')setBoundary('start');if(event.key===']')setBoundary('end');
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undoTask();}
  if(event.key==='Delete'&&selectedObject())deleteObject();
  if(event.key==='Enter'&&event.target.dataset.segment)selectSegment(event.target.dataset.segment);
}
async function initialise() {
  if(loaded.backup){const issues=validateBackup(loaded.backup);if(issues.length){state.tasks=structuredClone(SEED_TASKS);state.blocked=true;}}
  if(!cloud)state.tasks=state.tasks.map(upgradeReviewTask);
  if(!state.tasks.some(task=>task.id===state.taskId))state.taskId=state.tasks[0].id;
  state.modality=currentTask().modality;
  document.addEventListener('click',handleClick);document.addEventListener('keydown',handleKey);
  workspace.addEventListener('input',event=>updateInput(event.target));
  document.querySelector('#task-search').addEventListener('input',event=>{state.query=event.target.value;renderTasks();});
  document.querySelector('#status-filter').addEventListener('change',event=>{state.filter=event.target.value;renderTasks();});
  document.querySelector('#media-import').addEventListener('change',async event=>{await importMedia([...event.target.files]);event.target.value='';});
  document.querySelector('#backup-import').addEventListener('change',async event=>{if(event.target.files[0])await restoreBackup(event.target.files[0]);event.target.value='';});
  window.addEventListener('beforeunload',event=>{if(cloud&&(editVersion>savedVersion||cloud.pending)){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pagehide',()=>{if(!state.blocked)saveTasks({quiet:true});for(const url of objectUrls.values())URL.revokeObjectURL(url);});
  hydrateIcons();await renderWorkspace();
  if(state.blocked){document.querySelector('#save-indicator').textContent='草稿保护中';showHelp();}
}
initialise().catch(error=>{workspace.innerHTML=`<div class="notice error">工作台载入失败：${esc(error.message)}。请保留本地草稿并导出备份。</div>`;});
