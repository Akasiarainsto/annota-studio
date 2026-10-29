import {escapeHtml as esc,downloadJson} from './utils.js';
import {validateAnnotationText} from './json-validation.js';
import {toTrainingRecord} from './validation-adapters.js';
import {PROFILES,ALLOWED_TAGS,CAPTION_FIELDS,AUDIO_DIALECTS,AUDIO_NOISE_TAGS} from './validation_rules/profiles.js';
import {normalizeMediaPath} from './validation_rules/common.js';
import {VALIDATION_CASES} from './validation-samples.js';

function renderValidator(mode) {
  return `<div class="json_mode_tabs" aria-label="JSON模态规则">${['audio','video','image'].map(key=>`<button class="${mode===key?'active':''}" data-json-mode="${key}">${PROFILES[key].project} · ${PROFILES[key].name} JSON</button>`).join('')}</div><section id="json-profile" class="json_profile"></section><div class="json_validator_toolbar"><button class="button small" data-json-action="current">载入当前标注</button><button class="button small" data-json-action="file">导入 JSON / JSONL</button><button class="button small" data-json-action="normal">正常样例</button><button class="button small" data-json-action="invalid">全部异常</button><button class="button small" data-json-action="corrected">修正后示例</button><label>格式 <select id="json-format"><option value="json">JSON</option><option value="jsonl">JSONL</option></select></label></div><div class="json_case_picker"><label for="json-case-select">专项检查案例</label><select id="json-case-select"></select><p id="json-case-explanation"></p></div><div id="json-image-scope" class="json_image_scope" hidden><span id="json-inventory-status">图片清单载入中</span><button class="button small" data-json-action="folder">选择图片根目录</button><button class="button small" data-json-action="inventory-reset">使用随包清单</button></div><div class="json_validator_grid"><section class="json_editor_panel"><label for="json-editor">本模态标注 JSON <span id="json-source-label"></span></label><textarea id="json-editor" spellcheck="false" aria-label="JSON 标注内容"></textarea><small>编辑和导入仅用于独立校验，不写回工作台。可载入旧版对应模态示例，也可检查当前 Annota 导出文件。</small></section><section class="json_report_panel" aria-label="JSON校验结果"><div id="json-summary" class="notice">运行校验后显示结果。</div><div id="json-issues" class="json_issue_list"></div><details class="json_rules"><summary>本模态规则与面试讲解</summary><div id="json-rules-body"></div></details></section></div><input id="json-file-input" type="file" accept=".json,.jsonl,application/json,text/plain" hidden><input id="json-image-folder" type="file" webkitdirectory multiple hidden>`;
}
const query=(context,selector)=>context.modal.querySelector(selector);
function invalidate(context) {
  context.report=null;query(context,'#json-summary').className='notice';
  query(context,'#json-summary').textContent='内容或检查范围已变更，请重新运行校验。';
  query(context,'#json-issues').innerHTML='';
  context.modal.querySelectorAll('[data-json-action="report"],[data-json-action="csv"]').forEach(button=>button.disabled=true);
}
function fillText(context,{text,label,format='json',filename='annotation.json'}) {
  query(context,'#json-editor').value=text;query(context,'#json-format').value=format;context.filename=filename;
  query(context,'#json-source-label').textContent=label;invalidate(context);
}
function runValidation(context) {
  const report=validateAnnotationText(query(context,'#json-editor').value,query(context,'#json-format').value,{modality:context.mode,inventory:context.inventory});
  context.report={...report,sourceName:context.filename,imageScope:context.mode==='image'?context.inventoryLabel:undefined};
  query(context,'#json-summary').className=`notice ${report.valid?'':'error'}`;
  query(context,'#json-summary').textContent=`${PROFILES[context.mode].name}规则${report.valid?'通过':'未通过'} · ${report.total} 条 · ${report.passed} 通过 / ${report.failed} 不通过 · ${report.issues.length} 个问题${report.skipped?`；备份中另 ${report.skipped} 条非本模态记录未检查`:''}${!report.total&&!report.valid?'（含文件级问题，记录数无法统计）':''}`;
  query(context,'#json-issues').innerHTML=report.issues.map((issue,index)=>`<button class="json_issue" data-json-issue="${index}"><strong>${esc(issue.message)}</strong><span>${esc(issue.code)} · 第 ${issue.line} 行，第 ${issue.column} 列${issue.recordIndex?` · 记录 ${issue.recordIndex}`:''}${issue.sample_id?` · ${esc(issue.sample_id)}`:''}</span><code>${esc(issue.field)}</code></button>`).join('')||'<div class="json_pass">本模态结构规则通过，内容质量仍需人工复核。</div>';
  context.modal.querySelectorAll('[data-json-action="report"],[data-json-action="csv"]').forEach(button=>button.disabled=false);
}
function updateProfile(context) {
  const profile=PROFILES[context.mode];
  query(context,'#modal-title').textContent=`${profile.project} · ${profile.name} JSON 校验`;
  query(context,'#json-profile').innerHTML=`<strong>${profile.summary}</strong><code>${esc(profile.contract)}</code>`;
  query(context,'#json-case-select').innerHTML='<option value="current" disabled>当前标注快照</option><option value="file" disabled>导入的文件</option>'+VALIDATION_CASES[context.mode].map(sample=>`<option value="${sample.key}">${esc(sample.title)}</option>`).join('');
  context.modal.querySelectorAll('[data-json-mode]').forEach(button=>button.classList.toggle('active',button.dataset.jsonMode===context.mode));
  query(context,'#json-image-scope').hidden=context.mode!=='image';
  const current=optionsTask(context);query(context,'[data-json-action="current"]').disabled=current.modality!==context.mode;
  const extra=context.mode==='image'?`标签集合：${[...ALLOWED_TAGS].join('、')}`:context.mode==='video'?`七项顺序：${CAPTION_FIELDS.join(' → ')}`:`方言：${[...AUDIO_DIALECTS].join('、')}。噪声：${[...AUDIO_NOISE_TAGS].join('、')}`;
  query(context,'#json-rules-body').innerHTML=`<ul>${profile.ruleNotes.map(note=>`<li>${note}</li>`).join('')}</ul><p>${extra}</p><p>${profile.limitation}</p><p>面试演示：正常样例 → 某个专项错误 → 定位 → 根据素材修正 → 复检 → 下载结果。结构通过不等于内容正确。</p>`;
}
function optionsTask(context){return context.options.getCurrentTask();}
function showCase(context,key) {
  const sample=VALIDATION_CASES[context.mode].find(sample=>sample.key===key)||VALIDATION_CASES[context.mode][0];
  context.caseKey=sample.key;query(context,'#json-case-select').value=sample.key;
  query(context,'#json-case-explanation').textContent=`${sample.description} 修正提示：${sample.fix}`;
  if(context.mode==='image')setInventory(context,context.bundleInventory,'实际加载成功的随包图片清单');
  fillText(context,{text:sample.text,format:sample.format,label:`${PROFILES[context.mode].project} · ${sample.title}`,filename:`${context.mode}_${sample.key}.${sample.format}`});
}
function currentAnnotation(context) {
  const task=optionsTask(context);if(task.modality!==context.mode)return;
  context.caseKey='current';query(context,'#json-case-select').value='current';
  query(context,'#json-case-explanation').textContent='由当前任务生成对应训练标注结构；保留人工内容，不补造缺失属性，也不写回任务库。';
  fillText(context,{text:JSON.stringify([toTrainingRecord(task)],null,2),label:`当前${PROFILES[context.mode].name}标注快照`,filename:`${task.id}_${context.mode}.json`});
}
function switchMode(context,mode) {
  context.drafts[context.mode]={text:query(context,'#json-editor').value,format:query(context,'#json-format').value,label:query(context,'#json-source-label').textContent,filename:context.filename,caseKey:context.caseKey,explanation:query(context,'#json-case-explanation').textContent};
  context.mode=mode;updateProfile(context);
  const draft=context.drafts[mode];
  if(draft){fillText(context,draft);context.caseKey=draft.caseKey;query(context,'#json-case-select').value=draft.caseKey;query(context,'#json-case-explanation').textContent=draft.explanation;}
  else showCase(context,'valid');
  runValidation(context);
}
function setInventory(context,inventory,label) {
  context.inventory=new Set(inventory);context.inventoryLabel=label;
  query(context,'#json-inventory-status').textContent=`${label} · ${context.inventory.size} 个文件，仅核对引用`;
  invalidate(context);
}
async function loadBundleInventory(context) {
  const assets=['a','b','c'].map(letter=>({path:`images/placeholder_${letter}.png`,url:`assets/validation_images/placeholder_${letter}.png`}));
  for(const task of context.options.seedTasks.filter(task=>task.modality==='image'))assets.push({path:task.media.name,url:task.media.url});
  const current=optionsTask(context);if(current.modality==='image'&&current.media.url)assets.push({path:current.media.name,url:current.media.url});
  const loaded=await Promise.all(assets.map(asset=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(normalizeMediaPath(asset.path));image.onerror=()=>resolve(null);image.src=asset.url;})));
  context.bundleInventory=new Set(loaded.filter(Boolean));
  if(!context.abort.signal.aborted)setInventory(context,context.bundleInventory,'实际加载成功的随包 / 当前图片清单');
}
function downloadText(context) {
  const format=query(context,'#json-format').value;
  const url=URL.createObjectURL(new Blob([query(context,'#json-editor').value],{type:'application/json;charset=utf-8'}));
  Object.assign(document.createElement('a'),{href:url,download:context.filename.replace(/\.[^.]*$/,'')+'.'+format}).click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadCsv(context) {
  if(!context.report)return;
  const escapeCell=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
  const columns=['recordIndex','sample_id','field','code','message','line','column'];
  const lines=[columns,...context.report.issues.map(issue=>columns.map(key=>issue[key]))].map(row=>row.map(escapeCell).join(','));
  const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));
  Object.assign(document.createElement('a'),{href:url,download:`${context.mode}_validation_issues.csv`}).click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function installEvents(context) {
  const signal=context.abort.signal;const modal=context.modal;
  const actions={current:()=>currentAnnotation(context),normal:()=>showCase(context,'valid'),invalid:()=>showCase(context,'invalid'),corrected:()=>showCase(context,context.mode==='image'?'practice_after':'corrected'),file:()=>query(context,'#json-file-input').click(),folder:()=>query(context,'#json-image-folder').click(),'inventory-reset':()=>setInventory(context,context.bundleInventory,'实际加载成功的随包图片清单'),run:()=>runValidation(context),download:()=>downloadText(context),csv:()=>downloadCsv(context),report:()=>{if(context.report)downloadJson(`${context.mode}_validation_report.json`,{...context.report,checkedAt:new Date().toISOString()});}};
  modal.addEventListener('click',event=>{
    const mode=event.target.closest('[data-json-mode]')?.dataset.jsonMode;if(mode){switchMode(context,mode);return;}
    const action=event.target.closest('[data-json-action]')?.dataset.jsonAction;if(action)actions[action]?.();
    const selected=event.target.closest('[data-json-issue]');if(!selected||!context.report)return;
    const issue=context.report.issues[Number(selected.dataset.jsonIssue)];const editor=query(context,'#json-editor');
    editor.focus();editor.setSelectionRange(issue.offset,issue.offset+issue.length);editor.scrollTop=Math.max(0,(issue.line-4)*20);
  },{signal});
  query(context,'#json-editor').addEventListener('input',()=>invalidate(context),{signal});
  query(context,'#json-format').addEventListener('change',()=>invalidate(context),{signal});
  query(context,'#json-case-select').addEventListener('change',event=>showCase(context,event.target.value),{signal});
  query(context,'#json-file-input').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;if(file.size>8000000){context.options.notify('单次文件最多 8 MB。');return;}
    const text=await file.text();if(signal.aborted)return;
    fillText(context,{text,label:file.name,filename:file.name,format:/\.jsonl$/i.test(file.name)?'jsonl':'json'});context.caseKey='file';query(context,'#json-case-select').value='file';event.target.value='';query(context,'#json-case-explanation').textContent='按当前选择的模态规则检查导入文件，不自动切换或混用规则。';runValidation(context);
  },{signal});
  query(context,'#json-image-folder').addEventListener('change',event=>{
    const files=[...event.target.files];const paths=files.map(file=>normalizeMediaPath((file.webkitRelativePath||file.name).split('/').slice(file.webkitRelativePath?1:0).join('/'))).filter(Boolean);
    setInventory(context,paths,'用户选择的图片根目录清单');event.target.value='';
  },{signal});
}
export async function openJsonValidator(options) {
  const modal=document.querySelector('#modal');
  const context={options,modal,mode:options.getCurrentTask().modality,abort:new AbortController(),report:null,filename:'annotation.json',drafts:{},inventory:new Set(),bundleInventory:new Set(),inventoryLabel:'载入中',caseKey:'valid'};
  modal.classList.add('json_validator_modal');query(context,'#modal-body').innerHTML=renderValidator(context.mode);
  query(context,'#modal-actions').innerHTML='<button class="button" data-json-action="download">下载当前文本</button><button class="button" data-json-action="csv" disabled>问题 CSV</button><button class="button" data-json-action="report" disabled>校验报告 JSON</button><button class="button primary" data-json-action="run">运行校验</button>';
  updateProfile(context);installEvents(context);
  modal.addEventListener('close',()=>{context.abort.abort();modal.classList.remove('json_validator_modal');},{once:true});
  modal.showModal();query(context,'#json-summary').textContent='正在读取可访问的图片清单…';
  await loadBundleInventory(context);if(context.abort.signal.aborted)return;
  currentAnnotation(context);runValidation(context);
}
