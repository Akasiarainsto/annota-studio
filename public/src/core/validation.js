import {isObject, hasText, isNumber, checkIds, issue} from './checks.js';
import {validateAudio} from './audio-validation.js';
import {validateVideo, validateVideoEvaluation} from './video-validation.js';
import {validateImage} from './image-validation.js';

export function validateDocument(doc, options = {}) {
  if (!isObject(doc)) return [issue('/','E_OBJECT','顶层须为一个标注对象')];
  if (doc.modality === 'video_evaluation') return validateVideoEvaluation(doc);
  if (!['audio','video','image'].includes(doc.modality)) return [issue('/modality','E_MODALITY','模态须为 audio、video 或 image')];
  const errors = [];
  if (doc.schema_version !== '1.0') errors.push(issue('/schema_version','E_VERSION','schema_version 须为 1.0'));
  if (!hasText(doc.task_id)) errors.push(issue('/task_id','E_REQUIRED','任务 ID 缺失'));
  if (!isObject(doc.media)) return [...errors,issue('/media','E_REQUIRED','媒体对象缺失')];
  if (!hasText(doc.media.id)||!hasText(doc.media.url)) errors.push(issue('/media','E_MEDIA_REF','媒体 ID 和 URL 必填'));
  if (options.media && (doc.media.id !== options.media.id || doc.media.url !== options.media.url)) errors.push(issue('/media','E_MEDIA_MISMATCH','媒体引用与任务原片不一致'));
  if (doc.modality === 'image') return [...errors,...validateImage(doc,options)];
  if (!isNumber(doc.media.duration_s)||doc.media.duration_s<=0) return [...errors,issue('/media/duration_s','E_DURATION','时长须为正数')];
  if (options.media && doc.media.duration_s !== options.media.duration_s) errors.push(issue('/media/duration_s','E_MEDIA_MISMATCH','不能改写原片时长以绕过越界检查'));
  if (!Array.isArray(doc.segments)||!doc.segments.length) return [...errors,issue('/segments','E_REQUIRED','至少创建一个片段')];
  checkIds(doc.segments,'/segments',errors);
  if(doc.clips!==undefined){
    if(!Array.isArray(doc.clips))errors.push(issue('/clips','E_ARRAY','clips 须为数组'));
    else {checkIds(doc.clips,'/clips',errors);doc.clips.forEach((clip,index)=>{if(!isObject(clip)||!isNumber(clip.start_s)||!isNumber(clip.end_s)||clip.start_s<0||clip.end_s>doc.media.duration_s||clip.end_s-clip.start_s<2.999||clip.end_s-clip.start_s>10.001||clip.media_id!==doc.media.id)errors.push(issue(`/clips/${index}`,'E_CLIP_RANGE','快捷 clip 须引用本媒体，范围有效且长 3–10 秒'));});}
  }
  return [...errors,...(doc.modality === 'audio' ? validateAudio(doc,options) : validateVideo(doc,options))];
}
