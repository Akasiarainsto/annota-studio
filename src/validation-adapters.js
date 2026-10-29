import {VIDEO_FIELDS} from './seed-data.js';
import {getAnnotationSnapshot} from './core.js';

export function createAnnotationDocument(task) {
  return {schemaVersion:'annota/1',kind:'annotation',task:getAnnotationSnapshot(task)};
}
export function toTrainingRecord(task) {
  const common={sample_id:task.id,split:task.split,is_demo:task.isDemo};
  if(task.modality==='image')return {...common,image_path:task.media?.name,caption:task.caption,tags:task.tags};
  if(task.modality==='video')return {...common,video_path:task.media?.name,duration:task.media?.duration,segments:Array.isArray(task.segments)?task.segments.map(segment=>({start:segment.start,end:segment.end,captions:Object.keys(VIDEO_FIELDS).map(key=>segment.description?.[key]??''),overlap_reason:segment.overlapReason??''})):task.segments};
  const first=task.segments?.[0] || {};
  return {id:task.id,source_id:task.sourceId||task.media?.blobKey||task.media?.name,audio_file:task.media?.name,duration:task.media?.duration,language:first.language,dialect:first.dialect==='普通话（合成）'?'普通话':first.dialect,scene:first.scene,kind:Array.isArray(task.segments)&&task.segments.length&&task.segments.every(segment=>String(segment.label).toLowerCase()==='noise')?'noise':'speech',segments:Array.isArray(task.segments)?task.segments.map(segment=>({start:segment.start,end:segment.end,text:segment.text,speaker:segment.speaker,language:segment.language,dialect:segment.dialect,scene:segment.scene})):task.segments,noise_tags:task.noiseTags??[],is_demo:task.isDemo};
}
export function mapTrainingField(modality,field) {
  const keys={sample_id:'id',source_id:'sourceId',image_path:'media.name',video_path:'media.name',audio_file:'media.name',duration:'media.duration',noise_tags:'noiseTags'};
  const caption=field.match(/^segments\[(\d+)\]\.captions(?:\[(\d+)\])?$/);
  if(caption)return `segments.${caption[1]}.description${caption[2]!==undefined?'.'+Object.keys(VIDEO_FIELDS)[Number(caption[2])] : ''}`;
  if(modality==='audio'&&['language','dialect','scene'].includes(field))return `segments.0.${field}`;
  if(field==='kind')return 'segments.0.label';
  if(field.includes('overlap_reason'))return field.replace('overlap_reason','overlapReason').replace(/\[(\d+)\]/g,'.$1');
  return keys[field] || field.replace(/\[(\d+)\]/g,'.$1');
}
