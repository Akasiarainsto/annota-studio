import {escapeHtml} from '../views/shared.js';

export function createWaveform(options) {
  const {root,getDocument,getSelected,onSelect,onSeek,onBoundary,onRangeSelected,readonly}=options;
  const svg=root.querySelector('svg');svg.setAttribute('preserveAspectRatio','none');const state={peaks:[],zoom:1,cursor:0,drag:null,create:false,selection:null};
  const width=()=>Math.max(600,root.clientWidth)*state.zoom;
  const toTime=event=>Math.max(0,Math.min(getDocument().media.duration_s,(event.clientX-svg.getBoundingClientRect().left)/svg.getBoundingClientRect().width*getDocument().media.duration_s));
  function render() {
    const doc=getDocument(),w=width(),h=svg.clientHeight||180,duration=doc.media.duration_s;const x=time=>time/duration*w;
    const top=h<100?20:28,labelTop=h-(h<100?18:24),middle=(top+labelTop)/2,amplitude=(labelTop-top)*.35;
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.style.width=w+'px';
    let waveform='';const scale=Math.max(.01,...state.peaks.map(Math.abs));
    state.peaks.forEach((peak,index)=>{const y=peak/scale*amplitude;const px=index/state.peaks.length*w;waveform+=`M${px.toFixed(1)},${(middle-y).toFixed(1)}v${(y*2).toFixed(1)}`;});
    svg.innerHTML=`<rect width="${w}" height="${h}" fill="var(--canvas)"/>${Array.from({length:Math.floor(duration)+1},(_,second)=>`<text x="${x(second)+3}" y="14">${second}</text><path class="ruler" d="M${x(second)},18v${labelTop-18}"/>`).join('')}<path class="wave-path" d="${waveform}"/>${doc.segments.map(segment=>{
      const start=state.drag?.id===segment.id&&state.drag?.edge==='start_s'?state.drag.time:segment.start_s;
      const end=state.drag?.id===segment.id&&state.drag?.edge==='end_s'?state.drag.time:segment.end_s;
      return `<g data-wave-segment="${escapeHtml(segment.id)}"><rect class="wave-region ${segment.id===getSelected()?.id?'active':''}" x="${x(start)}" y="${top}" width="${Math.max(0,x(end)-x(start))}" height="${labelTop-top}"/><rect class="wave-label" x="${x(start)}" y="${labelTop}" width="${Math.max(0,x(end)-x(start))}" height="${h-labelTop}"/><text class="region-name" x="${x(start)+7}" y="${h-6}">${escapeHtml(segment.id)}</text>${readonly?'':['start_s','end_s'].map(edge=>`<rect class="boundary-handle" data-edge="${edge}" data-id="${escapeHtml(segment.id)}" x="${x(edge==='start_s'?start:end)-4}" y="${edge==='start_s'?top:(top+h)/2}" width="8" height="${(h-top)/2}"><title>${escapeHtml(segment.id)} ${edge==='start_s'?'开始':'结束'}边界</title></rect>`).join('')}</g>`;
    }).join('')}<line class="playhead" x1="${x(state.cursor)}" x2="${x(state.cursor)}" y1="18" y2="${h-2}"/>${renderRange(x,top,h)}`;
  }
  function renderRange(x,top,h){const range=state.drag?.mode==='create'?{start:state.drag.start,end:state.drag.time}:state.selection;return range?`<rect class="new-range" x="${x(Math.min(range.start,range.end))}" y="${top}" width="${Math.abs(x(range.end)-x(range.start))}" height="${h-top}"/>`:'';}
  svg.addEventListener('pointerdown',event=>{
    const edge=event.target.closest('[data-edge]');const region=event.target.closest('[data-wave-segment]');
    if(state.create&&!readonly){state.drag={mode:'create',start:toTime(event),time:toTime(event)};svg.setPointerCapture(event.pointerId);return;}
    if(edge&&!readonly){state.drag={id:edge.dataset.id,edge:edge.dataset.edge,time:toTime(event)};svg.setPointerCapture(event.pointerId);event.preventDefault();return;}
    if(region)onSelect(region.dataset.waveSegment);else onSeek(toTime(event));
  });
  svg.addEventListener('pointermove',event=>{if(state.drag){state.drag.time=toTime(event);render();}});
  svg.addEventListener('pointerup',()=>{
    if(!state.drag)return;const drag=state.drag;state.drag=null;
    if(drag.mode==='create'){state.create=false;root.classList.remove('range-select');state.selection={start:Math.min(drag.start,drag.time),end:Math.max(drag.start,drag.time)};onRangeSelected(state.selection);}
    else onBoundary(drag);render();
  });
  const observer=new ResizeObserver(()=>render());observer.observe(root);render();
  return {render,destroy:()=>observer.disconnect(),setRange:range=>{state.selection=range;if(!range){state.create=false;root.classList.remove('range-select');}render();},setPeaks:samples=>{const count=1000;state.peaks=Array.from({length:count},(_,index)=>{const first=Math.floor(index*samples.length/count),last=Math.floor((index+1)*samples.length/count);let peak=0;for(let position=first;position<last;position++)peak=Math.max(peak,Math.abs(samples[position]));return peak;});render();},setCursor:value=>{state.cursor=value;const cursor=svg.querySelector('.playhead');if(cursor){const x=value/getDocument().media.duration_s*width();cursor.setAttribute('x1',x);cursor.setAttribute('x2',x);}},zoom:factor=>{state.zoom=Math.max(1,Math.min(8,state.zoom*factor));render();},create:()=>{state.create=!state.create;root.classList.toggle('range-select',state.create);return state.create;}};
}
