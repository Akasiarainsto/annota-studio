import {VIDEO_OPTIONS, getOptionValues} from './attributes.js';
import {isObject, isNumber, checkText, checkEnum, checkTime, issue} from './checks.js';

export function validateVideo(doc, options = {}) {
  const errors = [];
  if (!isNumber(doc.media.fps)||doc.media.fps<=0) errors.push(issue('/media/fps','E_FPS','帧率须为有限正数'));
  doc.segments.forEach((segment,index) => {
    if (!isObject(segment)) return;
    const path = `/segments/${index}`;
    checkTime(segment,{path,duration:doc.media.duration_s,code:'E_VIDEO_TIME_OUT_OF_RANGE'},errors);
    checkText(segment.caption,`${path}/caption`,errors);
    checkEnum(segment.boundary_status,['confirmed','pending_listen'],`${path}/boundary_status`,errors);
    if (!isObject(segment.dimensions)) return errors.push(issue(`${path}/dimensions`,'E_VIDEO_DIMENSIONS','请填写七维属性'));
    for (const [key,values] of Object.entries(VIDEO_OPTIONS)) checkEnum(segment.dimensions[key],getOptionValues(values),`${path}/dimensions/${key}`,errors);
    if (Object.values(segment.dimensions).some(value => ['uncertain','not_applicable','suspect'].includes(value))) checkText(segment.note,`${path}/note`,errors);
    if (options.submission && segment.boundary_status !== 'confirmed') errors.push(issue(`${path}/boundary_status`,'E_CONFIRM_BOUNDARY',`${segment.id} 尚未确认镜头与边界`));
  });
  for (let index=1; index<doc.segments.length; index++) {
    if (doc.segments[index]?.start_s < doc.segments[index-1]?.end_s) errors.push(issue(`/segments/${index}/start_s`,'E_VIDEO_OVERLAP','单轨镜头片段不能重叠或倒序'));
  }
  return errors;
}
export function validateVideoEvaluation(doc) {
  const errors = [];
  if (!Array.isArray(doc.candidates) || doc.candidates.length !== 2) return [issue('/candidates','E_PAIR','需要两条候选视频')];
  if(doc.candidates.some(item=>!isObject(item)||!isNumber(item.duration_s)||item.duration_s<=0))return [issue('/candidates','E_PAIR_METADATA','候选媒体与有限正时长缺失')];
  checkText(doc.input_ref,'/input_ref',errors);
  if (doc.candidates[0]?.media_id === doc.candidates[1]?.media_id) errors.push(issue('/candidates','E_PAIR','A/B 不能引用同一视频'));
  const duration = Math.min(...doc.candidates.map(item=>item.duration_s));
  if (!isObject(doc.comparison)) return [...errors,issue('/comparison','E_REQUIRED','共同范围缺失')];
  checkTime({start_s:doc.comparison.start_s,end_s:doc.comparison.end_s},{path:'/comparison',duration,code:'E_SHARED_RANGE_OUT_OF_BOUNDS'},errors);
  if (!Array.isArray(doc.ratings)) return [...errors,issue('/ratings','E_REQUIRED','评分列表缺失')];
  doc.ratings.forEach((rating,index) => {
    if (!isObject(rating)) return errors.push(issue(`/ratings/${index}`,'E_OBJECT','评分须为对象'));
    for (const side of ['a','b']) {
      const score = rating[`score_${side}`];
      if (score !== null && (!Number.isInteger(score)||score<1||score>5)) errors.push(issue(`/ratings/${index}/score_${side}`,'E_SCORE','分数须为 1–5 或 null'));
      if (score !== null && score < 3) checkText(rating[`reason_${side}`],`/ratings/${index}/reason_${side}`,errors);
    }
  });
  return errors;
}
