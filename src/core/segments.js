export const clone = value => structuredClone(value);
export const makeId = prefix => `${prefix}${crypto.randomUUID().slice(0,7)}`;
export function splitSegment(doc, options) {
  const {id,time}=options; const next=clone(doc); const index=next.segments.findIndex(segment=>segment.id===id);
  const segment=next.segments[index];
  if (!segment||time<=segment.start_s+.05||time>=segment.end_s-.05) throw new Error('请将播放点放在当前片段内部（距边界至少 0.05 秒）');
  const field=doc.modality==='audio'?'transcript':'caption';
  const tail={...clone(segment),id:makeId('S'),start_s:time,[field]:'',boundary_status:'pending_listen'};
  segment.end_s=time;segment.boundary_status='pending_listen';next.segments.splice(index+1,0,tail);
  return next;
}
export function mergeSegment(doc, id) {
  const next=clone(doc);const index=next.segments.findIndex(segment=>segment.id===id);
  const first=next.segments[index],second=next.segments[index+1];
  if (!second) throw new Error('当前片段后没有可合并的片段');
  if (doc.modality==='audio'&&first.speaker_id!==second.speaker_id) throw new Error('两段说话人不同，请先核对说话人，不能直接合并');
  const field=doc.modality==='audio'?'transcript':'caption';
  first.end_s=second.end_s;first[field]=`${first[field]}${second[field]}`;first.boundary_status='pending_listen';
  next.segments.splice(index+1,1);return next;
}
export function addSegment(doc, range) {
  const {start,end}=range;
  validateRange(doc,range);
  const overlaps=findRangeOverlaps(doc,range);
  if (overlaps.length) throw new Error(`选区与 ${overlaps.map(segment=>segment.id).join('、')} 重叠。新建片段只能放在空白处；可改用“调整当前片段”或先分割。`);
  const next=clone(doc); const template=clone(doc.segments[0]||(doc.modality==='audio'?{speaker_id:'S1',language:'',scene:'',quality:'',overlap:false}:{dimensions:{}}));
  const segment={...template,id:makeId('S'),start_s:start,end_s:end,boundary_status:'pending_listen',note:''};
  segment[doc.modality==='audio'?'transcript':'caption']='';next.segments.push(segment);next.segments.sort((a,b)=>a.start_s-b.start_s);
  return next;
}
function validateRange(doc,{start,end}) {
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>doc.media.duration_s||end-start<.05)throw new Error('请选择媒体内至少 0.05 秒的有效范围');
}
export function findRangeOverlaps(doc,range,excludeId=null) {
  return doc.segments.filter(segment=>segment.id!==excludeId&&range.start<segment.end_s&&range.end>segment.start_s);
}
export function setSegmentRange(doc,options) {
  const {id,start,end}=options;validateRange(doc,{start,end});
  const segment=doc.segments.find(item=>item.id===id);if(!segment)throw new Error('先选择需要调整的片段');
  const overlaps=findRangeOverlaps(doc,{start,end},id);
  if(overlaps.length)throw new Error(`调整后会与 ${overlaps.map(item=>item.id).join('、')} 重叠；请缩小选区，或先合并这些片段。`);
  const next=clone(doc);Object.assign(next.segments.find(item=>item.id===id),{start_s:start,end_s:end,boundary_status:'pending_listen'});return next;
}
export function createClip(doc,range) {
  const {start,seconds}=range;const end=Number((start+seconds).toFixed(3));
  if(seconds<3||seconds>10)throw new Error('快捷 clip 长度须为 3–10 秒');
  if(start<0||end>doc.media.duration_s)throw new Error(`剩余时长不足 ${seconds} 秒，请调整播放点或片段长度`);
  return {id:makeId('C'),start_s:start,end_s:end,media_id:doc.media.id};
}
