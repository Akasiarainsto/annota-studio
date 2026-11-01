import {escapeHtml,icon,time} from '../views/shared.js';
import {createSegmentController} from './segment-controller.js';
import {createWaveform} from './waveform.js';
import {createRangeSelection} from './range-selection.js';
import {splitSegment,mergeSegment,createClip,clone} from '../core/segments.js';
import {exportMediaClip} from '../services/clip-export.js';
import {downloadFile} from '../services/api.js';

// This lifecycle function owns a persistent video element; editing fields must never recreate playback.
export async function mountVideoEditor(options) {
  const {root,task,getDocument,onChange,onError,readonly}=options;const doc=getDocument();
  const state={loop:false,frame:0,exporting:false,abort:new AbortController()};
  root.innerHTML=`<div class="visual-editor"><div class="video-left"><div class="video-screen"><video src="${escapeHtml(doc.media.url)}" preload="auto" playsinline></video><span class="video-watermark">${escapeHtml(task.source.name)}</span></div><div class="transport compact"><button class="play-button" data-video-action="play" aria-label="播放或暂停视频">${icon('play')}</button><span id="video-time" class="numeric">00:00.000 / ${time(doc.media.duration_s)}</span><select id="video-speed" aria-label="视频倍速"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option></select><button data-video-action="loop">循环</button><button data-video-action="split" ${readonly?'disabled':''}>分割</button><button data-video-action="merge" ${readonly?'disabled':''}>合并</button><select id="video-clip-duration" aria-label="视频快捷片段长度">${Array.from({length:8},(_,i)=>`<option value="${i+3}">${i+3} 秒</option>`).join('')}</select><button data-video-action="clip" ${readonly?'disabled':''}>切片</button><button data-video-action="range" ${readonly?'disabled':''}>拖选范围</button><button data-video-action="download">${icon('download')} 导出片段</button><button data-history="undo" title="撤销最近一步（Ctrl+Z）" ${readonly?'disabled':''}>${icon('undo')} 撤销</button><button data-history="redo" title="重做（Ctrl+Shift+Z）" ${readonly?'disabled':''}>${icon('redo')} 重做</button></div><input id="video-seek" type="range" min="0" max="${doc.media.duration_s}" step="0.01" value="0" aria-label="视频播放进度"><div class="timeline-scroll video-timeline"><svg class="waveform" role="img" aria-label="视频时间轴，拖动手柄调整边界"></svg></div><div class="range-selection-host" hidden></div><div class="segment-rows video-segments"></div><div class="editor-hint">拖选范围后选择用途；新建仅限空白处，调整当前片段会重新要求人工确认。Caption 描述实际画面。</div></div><aside class="properties-scroll video-properties"></aside></div>`;
  const player=root.querySelector('video');let timeline,rangeSelection;
  const controls=createSegmentController({...options,onSeek:value=>{player.currentTime=value;},onSelect:()=>{timeline?.render();rangeSelection?.refresh();}});
  const commit=next=>{onChange(next);controls.refresh();timeline.render();};
  timeline=createWaveform({root:root.querySelector('.timeline-scroll'),getDocument,getSelected:()=>controls.current,readonly,onSelect:id=>controls.select(id),onSeek:value=>{player.currentTime=value;},onBoundary:drag=>{const next=clone(getDocument());const segment=next.segments.find(item=>item.id===drag.id);segment[drag.edge]=Number(drag.time.toFixed(3));segment.boundary_status='pending_listen';commit(next);},onRangeSelected:range=>rangeSelection.show(range)});
  rangeSelection=createRangeSelection({root,getDocument,getSelected:()=>controls.current,onCommit:commit,onSelect:id=>controls.select(id),onClear:()=>timeline.setRange(null),onError,onExport:range=>exportRange({start_s:range.start,end_s:range.end})});
  const play=async()=>{if(player.paused)await player.play();else player.pause();};
  const loop=async()=>{if(!controls.current)throw new Error('先选片段');state.loop=!state.loop;if(state.loop){player.currentTime=controls.current.start_s;await player.play();}root.querySelector('[data-video-action="loop"]').classList.toggle('selected',state.loop);};
  async function exportRange(segment,quickClip=null) {
    if(state.exporting)throw new Error('片段正在编码');if(!segment)throw new Error('先选择片段或拖选范围');
    state.exporting=true;player.pause();const button=root.querySelector('[data-video-action="download"]');button.disabled=true;
    try{const result=await exportMediaClip({task:{...task,media:{...doc.media,name:task.id+'.mp4'}},segment:{start:segment.start_s,end:segment.end_s},signal:state.abort.signal,onProgress:progress=>{button.textContent=`编码 ${Math.round(progress*100)}%`;}});downloadFile(result.filename,result.blob);if(quickClip){const next=clone(getDocument());next.clips=[...(next.clips||[]),{...quickClip,file_name:result.filename}];commit(next);}options.toast('已导出真实 WebM 片段（含原音轨），编码按播放时间进行');}finally{state.exporting=false;button.disabled=false;button.innerHTML=icon('download')+' 导出片段';}
  }
  const act=async action=>{
    if(action==='play')await play();if(action==='loop')await loop();
    if(action==='split')commit(splitSegment(getDocument(),{id:controls.current?.id,time:Number(player.currentTime.toFixed(3))}));
    if(action==='merge')commit(mergeSegment(getDocument(),controls.current?.id));
    if(action==='range'){player.pause();const active=timeline.create();root.querySelector('[data-video-action=range]').classList.toggle('selected',active);if(active)options.toast('在时间轴拖出选区，再选择新建、调整当前片段或导出');}
    if(action==='clip'){const clip=createClip(getDocument(),{start:Number(player.currentTime.toFixed(3)),seconds:Number(root.querySelector('#video-clip-duration').value)});await exportRange(clip,clip);}
    if(action==='download')await exportRange(controls.current);
  };
  root.addEventListener('click',async event=>{const action=event.target.closest('[data-video-action]')?.dataset.videoAction;if(action)try{await act(action);}catch(error){onError(error);}});
  root.querySelector('#video-seek').addEventListener('input',event=>{player.currentTime=Number(event.target.value);});
  root.querySelector('#video-speed').addEventListener('change',event=>{player.playbackRate=Number(event.target.value);});
  player.addEventListener('error',()=>onError(new Error('视频无法解码，请使用支持该文件的 Edge 或 Chrome')));
  function tick(){if(state.loop&&controls.current&&!player.paused&&player.currentTime>=controls.current.end_s)player.currentTime=controls.current.start_s;timeline.setCursor(player.currentTime);root.querySelector('#video-time').textContent=`${time(player.currentTime)} / ${time(doc.media.duration_s)}`;root.querySelector('#video-seek').value=player.currentTime;root.querySelector('[data-video-action="play"]').innerHTML=icon(player.paused?'play':'pause');state.frame=requestAnimationFrame(tick);}
  tick();
  return {refresh:()=>{controls.refresh();timeline.render();},select:id=>controls.select(id),get selected(){return controls.current;},get currentTime(){return player.currentTime;},seek:value=>{player.currentTime=value;},play,loop,nudge:delta=>{if(readonly||!controls.current)return;controls.update({end_s:Number((controls.current.end_s+delta).toFixed(3)),boundary_status:'pending_listen'},true);timeline.render();},destroy:async()=>{timeline.destroy();state.abort.abort();cancelAnimationFrame(state.frame);player.pause();}};
}
