import {addSegment,setSegmentRange} from '../core/segments.js';
import {time,escapeHtml} from '../views/shared.js';

export function createRangeSelection(options) {
  const {root,getDocument,getSelected,onCommit,onSelect,onExport,onClear,onError}=options;
  const host=root.querySelector('.range-selection-host');const state={range:null,busy:false};
  function show(range) {
    state.range={start:Number(range.start.toFixed(3)),end:Number(range.end.toFixed(3))};host.hidden=false;
    const segment=getSelected();
    host.innerHTML=`<div class="time-range-bar" role="region" aria-label="拖选范围操作"><strong>选区 ${time(state.range.start)} — ${time(state.range.end)}</strong><span class="muted">${(state.range.end-state.range.start).toFixed(3)} 秒${segment?' · 当前 '+escapeHtml(segment.id):''}</span><button data-range-action="new">新建片段</button><button data-range-action="replace" ${segment?'':'disabled'}>调整当前片段</button><button data-range-action="export">导出选区</button><button data-range-action="cancel" class="text-button">取消选区</button><p class="range-error error-text" role="alert" hidden></p></div>`;
    root.querySelector('[data-audio-action=range],[data-video-action=range]')?.classList.remove('selected');
  }
  function clear(){state.range=null;host.hidden=true;host.innerHTML='';root.querySelector('[data-audio-action=range],[data-video-action=range]')?.classList.remove('selected');onClear();}
  root.addEventListener('click',async event=>{
    const button=event.target.closest('[data-range-action]');if(!button||state.busy||!state.range)return;
    const action=button.dataset.rangeAction;
    try{
      if(action==='cancel'){clear();return;}
      if(action==='export'){state.busy=true;button.disabled=true;await onExport(state.range);return;}
      const before=getDocument();const next=action==='new'?addSegment(before,state.range):setSegmentRange(before,{id:getSelected()?.id,...state.range});
      const selected=action==='new'?next.segments.find(segment=>!before.segments.some(previous=>previous.id===segment.id))?.id:getSelected()?.id;
      onCommit(next);if(selected)onSelect(selected);clear();
    }catch(error){const message=host.querySelector('.range-error');if(message){message.hidden=false;message.textContent=error.message;}onError(error);}
    finally{state.busy=false;if(button.isConnected)button.disabled=false;}
  });
  return {show,clear,refresh:()=>{if(state.range)show(state.range);}};
}
