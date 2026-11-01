import {renderSegmentRows,renderProperties} from '../views/segments.js';
import {clone} from '../core/segments.js';

export function createSegmentController(options) {
  const {root,getDocument,onChange,readonly,onSelect,onError,originalSegments=[]}=options;
  const state={selected:getDocument().segments[0]?.id};
  const current=()=>getDocument().segments.find(segment=>segment.id===state.selected);
  const update=(patch,redraw=false)=>{
    if (readonly) return;
    const doc=clone(getDocument());const segment=doc.segments.find(item=>item.id===state.selected);
    Object.assign(segment,patch);
    if(['speaker_id','language','scene','quality','overlap','dimensions'].some(key=>Object.hasOwn(patch,key)))segment.boundary_status='pending_listen';
    onChange(doc);if(redraw)refresh();
  };
  function refresh() {
    const doc=getDocument();if(!current())state.selected=doc.segments[0]?.id;
    root.querySelector('.segment-rows').innerHTML=renderSegmentRows(doc,state.selected,readonly);
    const props=root.querySelector('.video-properties');if(props)props.innerHTML=renderProperties(doc,current(),readonly);
    const original=root.querySelector('#segment-original');
    if(original)original.textContent=originalSegments.find(segment=>segment.id===state.selected)?.transcript||'新建片段，无独立机器稿';
    onSelect?.(current());
  }
  function select(id, seek=false) {state.selected=id;refresh();if(seek)options.onSeek(current()?.start_s||0);}
  root.addEventListener('click',event=>{
    const choice=event.target.closest('[data-choice]');
    if(choice&&!readonly){const doc=getDocument();const patch=doc.modality==='video'?{dimensions:{...current().dimensions,[choice.dataset.choice]:choice.dataset.value}}:{[choice.dataset.choice]:choice.dataset.value};update(patch,true);}
    const target=event.target.closest('[data-select-segment],[data-locate-segment]');
    if(target)select(target.dataset.selectSegment||target.dataset.locateSegment,!!target.dataset.locateSegment);
    if(event.target.closest('[data-add-speaker]')&&!readonly){const doc=clone(getDocument());let index=1;while(doc.speakers.some(speaker=>speaker.id==='S'+index))index++;doc.speakers.push({id:'S'+index});onChange(doc);refresh();}
    if(event.target.closest('[data-delete-segment]')&&!readonly){const doc=clone(getDocument());doc.segments=doc.segments.filter(segment=>segment.id!==state.selected);onChange(doc);refresh();}
  });
  root.addEventListener('input',event=>{
    if(readonly)return;const target=event.target;
    if(target.dataset.textField){const doc=clone(getDocument());const segment=doc.segments[Number(target.dataset.index)];segment[target.dataset.textField]=target.value;segment.boundary_status='pending_listen';onChange(doc);const checked=root.querySelector('[data-confirm-boundary]');if(checked&&segment.id===state.selected)checked.checked=false;}
    if(target.matches('[data-segment-note]'))update({note:target.value});
    if(target.matches('[data-selected-caption]')){update({caption:target.value,boundary_status:'pending_listen'});const checked=root.querySelector('[data-confirm-boundary]');if(checked)checked.checked=false;const row=root.querySelector(`textarea[data-index="${getDocument().segments.findIndex(item=>item.id===state.selected)}"]`);if(row)row.value=target.value;}
  });
  root.addEventListener('change',event=>{
    if(readonly)return;const target=event.target;
    if(target.dataset.timeField){const doc=clone(getDocument());const segment=doc.segments[Number(target.dataset.index)];segment[target.dataset.timeField]=target.value===''?null:Number(target.value);segment.boundary_status='pending_listen';onChange(doc);onSelect?.(current());}
    if(target.matches('[data-confirm-boundary]'))update({boundary_status:target.checked?'confirmed':'pending_listen'},true);
    if(target.matches('[data-overlap]'))update({overlap:target.checked},true);
  });
  refresh();
  return {refresh,select,get current(){return current();},update};
}
