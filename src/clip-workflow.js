import {getClipRange} from './operations-core.js';
import {exportMediaClip} from './clip-export.js';
import {downloadBlob,escapeHtml as esc} from './utils.js';

export function createClipWorkflow(options) {
  const state={abort:null};const dialog=document.querySelector('#modal'),input=document.querySelector('#clip-source-file');
  function quickClip() {
    const task=options.getTask();const range=getClipRange({start:options.getTime(),duration:task.media.duration,clipSeconds:Number(document.querySelector('#clip-duration').value)});
    if(!range.ok){options.notify(range.message);return;}
    if(task.modality==='audio'&&task.segments.some(segment=>segment.start<range.end&&segment.end>range.start)){options.notify('此范围已有音频标注；请移动播放位置，或先创建空白练习。');return;}
    options.addSegment(range);options.seek(range.end);options.notify('片段已创建；填写转写并试听核对音文对齐。');
  }
  function chooseSource() {
    options.showModal('读取原始素材',`<p>双击文件版需要重新选择源文件来导出真实媒体。</p><p class="mono">${esc(options.getTask().media.name)}</p>`,'<button class="button primary" data-action="clip-source">选择此任务的原始素材</button><button class="button" data-action="close-modal">取消</button>');
  }
  async function exportClip(sourceFile=null) {
    const task=options.getTask(),segment=options.getSegment();if(!segment){options.notify('请先选择一个片段');return;}
    let sourceBlob=sourceFile;if(!sourceBlob&&task.media.imported)sourceBlob=await options.readMedia(task.media.blobKey||task.id);
    if(!sourceBlob&&location.protocol==='file:'){chooseSource();return;}
    if(sourceFile&&sourceFile.name!==task.media.name){options.notify('文件名与此任务的原始素材不一致，请重新选择');return;}
    if(dialog.open)dialog.close();const abort=new AbortController();state.abort=abort;
    options.showModal('导出真实片段',`<p>${task.modality==='audio'?'生成 PCM WAV':'浏览器重编码为 WebM'} · ${segment.start.toFixed(3)}–${segment.end.toFixed(3)} 秒</p><p id="clip-progress">正在读取源媒体…</p><small>视频导出请保持此页前台；切换页面会取消导出。</small>`,'<button class="button" data-action="cancel-clip">取消导出</button>');
    try {
      const result=await exportMediaClip({task,segment,sourceBlob,signal:abort.signal,onProgress:value=>{const progress=document.querySelector('#clip-progress');if(progress)progress.textContent=`正在编码 ${Math.round(value*100)}%`;}});
      state.abort=null;downloadBlob(result.filename,result.blob);dialog.close();options.notify('真实媒体片段已生成并下载');
    }catch(error){state.abort=null;if(dialog.open)dialog.close();options.notify(error.name==='AbortError'?'导出已取消；视频编码需保持页面前台。':`片段导出失败：${error.message}`);}
  }
  input.addEventListener('change',async()=>{const file=input.files[0];input.value='';if(file)await exportClip(file);});
  dialog.addEventListener('close',()=>{state.abort?.abort();state.abort=null;});
  return {quickClip,exportClip,chooseFile:()=>input.click(),cancel(){state.abort?.abort();},get active(){return !!state.abort;}};
}
