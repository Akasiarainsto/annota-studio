import {escapeHtml,icon,MODALITY} from './shared.js';
import {inspectJsonText} from '../core/json-validation.js';
import {makeValidExample,makeInvalidExample,ERROR_CASES} from '../services/samples.js';
import {request,downloadFile} from '../services/api.js';

const SAMPLE_TASK_IDS={audio:'A-001',video:'V-001',image:'I-001'};
// Own editor provenance and the exact text snapshot that produced the displayed result in one lifecycle.
export async function mountJsonPage(options) {
  const {root,tasks,currentTask,onApply,onError,toast}=options;
  const state={modality:currentTask?.modality||'audio',task:null,result:null,validatedText:null,source:'',edited:false,run:0,loadVersion:0};
  root.innerHTML=`<section class="page json-page"><div class="page-heading json-heading"><div><span class="eyebrow">结构 / 字段 / 媒体约束</span><h1>JSON 校验</h1><p>选择错例即载入对应 JSON；校验始终读取左侧当前文本，手动修改后需重新执行。</p></div><button id="json-report">${icon('download')} 导出报告</button></div><div class="task-filters">${Object.entries(MODALITY).map(([key,label])=>`<button data-json-modality="${key}">${label}</button>`).join('')}</div><div class="json-toolbar"><button id="json-current">当前任务</button><button id="json-good">合格样例</button><select id="json-error-type" aria-label="选择错例并自动载入"></select><button id="json-bad">重新载入错例</button><button id="json-import">导入 JSON / JSONL</button><button id="json-format">格式化</button><button id="json-check" class="primary">执行校验</button><button id="json-apply">应用到当前草稿</button><input id="json-file" type="file" accept=".json,.jsonl" hidden></div><div class="json-split"><div class="json-editor-pane"><div class="json-editor-label"><span id="json-doc-label"></span><span>可直接编辑 · 点击错误定位字段</span></div><textarea id="json-editor" spellcheck="false" aria-label="JSON 编辑器"></textarea></div><aside id="json-results" class="json-results"></aside></div><p class="json-footnote">合格/错误样例使用固定教学任务；“当前任务”读取你的草稿。错例为人为构造，结果由当前 JSON 实际计算。</p></section>`;
  const input=root.querySelector('#json-editor'),results=root.querySelector('#json-results'),caseSelect=root.querySelector('#json-error-type');
  function refreshSource(){root.querySelector('#json-doc-label').textContent=state.source+(state.edited?' · 已编辑':'');}
  function invalidate(message='内容已修改，请重新执行校验') {
    state.result=null;state.validatedText=null;root.querySelector('#json-apply').disabled=true;
    results.innerHTML=`<div class="json-results-heading"><strong>待重新校验</strong></div><p class="json-pending">${escapeHtml(message)}</p>`;
  }
  function setText(text,label,kind){input.value=text;state.source=label;state.edited=false;refreshSource();root.querySelector('#json-good').classList.toggle('selected',kind==='good');root.querySelector('#json-current').classList.toggle('selected',kind==='current');root.querySelector('#json-bad').classList.toggle('selected',kind==='bad');invalidate('内容已载入，准备校验');}
  function showResult() {
    const text=input.value,result=inspectJsonText(text);state.result=result;state.validatedText=text;state.run++;
    const at=new Date().toLocaleTimeString('zh-CN',{hour12:false});
    results.innerHTML=`<div class="json-results-heading"><strong class="${result.valid?'success-text':'error-text'}">${result.valid?'检查通过':result.issues.length+' 项错误'}</strong><div class="muted">${result.records.length} 条记录 · ${result.format.toUpperCase()}</div><small class="muted">第 ${state.run} 次校验 · ${at}</small></div>${result.valid?'<p class="json-success">结构与模态规则通过。程序未判断正文事实、听写或画面质量。</p>':result.issues.map((error,index)=>`<button class="json-error-item" data-json-error="${index}"><code>${escapeHtml(error.code)}</code><span>${escapeHtml(error.message)}</span><small>第 ${error.line} 行，第 ${error.column} 列 · ${escapeHtml(error.path)}</small></button>`).join('')}`;
    root.querySelector('#json-apply').disabled=!(result.valid&&result.records.length===1&&currentTask?.canEdit&&result.records[0]?.task_id===currentTask.id);
    return result;
  }
  async function loadError() {
    const kind=caseSelect.value;if(!kind||!state.task)return;
    const modality=state.modality;
    if(state.task.id!==SAMPLE_TASK_IDS[modality]){await load(modality);if(state.modality!==modality)return;caseSelect.value=kind;}
    const label=ERROR_CASES[state.modality].find(([key])=>key===kind)[1];
    setText(JSON.stringify(makeInvalidExample(state.task,kind),null,2),`${MODALITY[state.modality]} · ${state.task.id} · 错例：${label}（已载入）`,'bad');
    root.querySelector('#json-bad').disabled=false;showResult();
  }
  async function load(modality,example='good') {
    const loadVersion=++state.loadVersion;
    input.disabled=true;
    root.querySelectorAll('.json-toolbar button,.json-toolbar select').forEach(control=>control.disabled=true);
    invalidate('正在载入'+MODALITY[modality]+'内容…');
    const summary=tasks.find(task=>task.id===SAMPLE_TASK_IDS[modality]);
    const task=example==='current'?currentTask:await request('/tasks/'+summary.id);
    if(loadVersion!==state.loadVersion)return;
    state.modality=modality;state.task=task;
    root.querySelectorAll('[data-json-modality]').forEach(button=>button.classList.toggle('active',button.dataset.jsonModality===modality));
    caseSelect.innerHTML='<option value="" disabled selected>选择错例（选后载入）</option>'+ERROR_CASES[modality].map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
    setText(JSON.stringify(example==='current'?task.draft:makeValidExample(task),null,2),`${MODALITY[modality]} · ${task.id} · ${example==='current'?'当前任务内容':'合格样例'}`,example);
    root.querySelectorAll('.json-toolbar button,.json-toolbar select').forEach(control=>control.disabled=false);
    root.querySelector('#json-current').disabled=!currentTask;root.querySelector('#json-bad').disabled=true;input.disabled=false;showResult();
  }
  input.addEventListener('input',()=>{state.edited=true;refreshSource();invalidate();});
  caseSelect.addEventListener('change',async()=>{try{await loadError();}catch(error){invalidate(error.message);onError(error);}});
  root.addEventListener('click',async event=>{
    try {
      const modality=event.target.closest('[data-json-modality]');if(modality)await load(modality.dataset.jsonModality);
      const errorItem=event.target.closest('[data-json-error]');if(errorItem&&state.result&&state.validatedText===input.value){const error=state.result.issues[Number(errorItem.dataset.jsonError)];input.focus();input.setSelectionRange(error.offset,error.offset+(error.length||1));input.scrollTop=Math.max(0,(error.line-5)*23);}
      const id=event.target.closest('button')?.id;
      if(id==='json-check')showResult();
      if(id==='json-current'){if(!currentTask)throw new Error('先打开一个任务，再读取当前任务内容');await load(currentTask.modality,'current');}
      if(id==='json-good')await load(state.modality);
      if(id==='json-bad')await loadError();
      if(id==='json-import')root.querySelector('#json-file').click();
      if(id==='json-format'){const result=showResult();if(!result.records.length||result.issues.some(error=>error.code.startsWith('E_JSON')))throw new Error('先修正 JSON 语法、重复字段或数值错误');input.value=result.format==='jsonl'?result.records.map(doc=>JSON.stringify(doc)).join('\n'):JSON.stringify(result.records.length===1?result.records[0]:result.records,null,2);showResult();}
      if(id==='json-report'){const result=showResult();downloadFile('json-validation-report.json',JSON.stringify({at:new Date().toISOString(),source:state.source+(state.edited?' · 已编辑':''),valid:result.valid,recordCount:result.records.length,issues:result.issues},null,2));}
      if(id==='json-apply'){const result=showResult();if(!result.valid||result.records.length!==1)throw new Error('仅能应用一条校验通过的记录');await onApply(result.records[0]);}
    }catch(error){onError(error);}
  });
  root.querySelector('#json-file').addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file)return;caseSelect.value='';root.querySelector('#json-bad').disabled=true;setText(await file.text(),file.name,'file');showResult();toast('文件已读入，可修订后重新校验');}catch(error){invalidate(error.message);onError(error);}});
  await load(state.modality,currentTask?'current':'good');
  return {destroy:async()=>{state.loadVersion++;}};
}
