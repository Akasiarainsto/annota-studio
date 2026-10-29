import {isObject,hasText,makeIssue,normalizeMediaPath,validateTextFields,validateSegmentTimes} from './common.js';
import {PROFILES,AUDIO_SUFFIXES, AUDIO_DIALECTS, AUDIO_NOISE_TAGS} from './profiles.js';
const RULES=PROFILES.audio;

function validateAudioSegment(options) {
  const {segment, field, position} = options;
  const issues = [];
  for (const name of ['text','speaker']) {
    if (!Object.hasOwn(segment,name)) issues.push(makeIssue(position,[`${field}.${name}`,'MISSING_FIELD',`缺少${name === 'text' ? '人工转写' : '说话人'}字段`]));
    else if (typeof segment[name] !== 'string') issues.push(makeIssue(position,[`${field}.${name}`,'FIELD_TYPE','必须是字符串']));
    else if (!segment[name].trim()) issues.push(makeIssue(position,[`${field}.${name}`,name === 'text' ? 'TRANSCRIPT_MISSING' : 'SPEAKER_MISSING',name === 'text' ? '转写缺失；听不清或纯噪声需按规则写明标记' : '说话人未填写；纯噪声可标不适用']));
  }
  if (Object.hasOwn(segment,'asr') && typeof segment.asr !== 'string') issues.push(makeIssue(position,[`${field}.asr`,'FIELD_TYPE','预标注 asr 必须是字符串，可以为空']));
  return issues;
}

function validateAudioSegments(position, record) {
  if (!Object.hasOwn(record,'segments')) return [];
  if (!Array.isArray(record.segments)) return [makeIssue(position,['segments','FIELD_TYPE','segments 必须是音频片段数组'])];
  if (!record.segments.length) return [makeIssue(position,['segments','EMPTY_SEGMENTS','至少填写一个音频片段'])];
  const issues = [], validRanges = [];
  record.segments.forEach((segment,index) => {
    const field = `segments[${index}]`;
    if (!isObject(segment)) { issues.push(makeIssue(position,[field,'SEGMENT_TYPE','每个片段必须是对象'])); return; }
    const timeIssues = validateSegmentTimes({segment,duration:record.duration,field,position});
    issues.push(...timeIssues,...validateAudioSegment({segment,field,position}));
    if (timeIssues.length) return;
    if (validRanges.some(previous => segment.start < previous.end && segment.end > previous.start)) issues.push(makeIssue(position,[field,'AUDIO_OVERLAP','当前 Dolphin 单通道标注不允许片段重叠；混说须人工复核']));
    validRanges.push(segment);
  });
  return issues;
}

function validateAudioAttributes(position, record) {
  const issues = [];
  if (Object.hasOwn(record,'kind') && !['speech','noise'].includes(record.kind)) issues.push(makeIssue(position,['kind','KIND_ENUM','kind 必须是 speech 或 noise']));
  if (typeof record.dialect === 'string' && !AUDIO_DIALECTS.has(record.dialect)) issues.push(makeIssue(position,['dialect','DIALECT_ENUM','方言属性不在演示约定内；无法判断可填待判定']));
  if (Object.hasOwn(record,'noise_tags')) {
    if (!Array.isArray(record.noise_tags)) issues.push(makeIssue(position,['noise_tags','FIELD_TYPE','noise_tags 必须是数组']));
    else {
      record.noise_tags.forEach((tag,index) => {
        if (!AUDIO_NOISE_TAGS.has(tag)) issues.push(makeIssue(position,[`noise_tags[${index}]`,'NOISE_TAG_ENUM','噪声标签须为背景噪声/音乐/静音/听不清/混说待复核之一']));
      });
      if (record.kind === 'noise' && !record.noise_tags.length) issues.push(makeIssue(position,['noise_tags','NOISE_TAG_MISSING','非语音任务至少填写一个噪声或静音标签']));
    }
  }
  if (Object.hasOwn(record,'reference') && typeof record.reference !== 'string') issues.push(makeIssue(position,['reference','FIELD_TYPE','参考稿必须是字符串；可为空，空参考稿不计算 CER']));
  return issues;
}

export function validateAudioRecord(row) {
  const [position,record] = row;
  if (!isObject(record)) return [makeIssue(position,['$','RECORD_TYPE','每条记录必须是 JSON 对象'])];
  const issues = RULES.requiredFields.filter(field => !Object.hasOwn(record,field)).sort().map(field => makeIssue(position,[field,'MISSING_FIELD','缺少必填字段']));
  issues.push(...validateTextFields(position,record,RULES),...validateAudioSegments(position,record),...validateAudioAttributes(position,record));
  if (Object.hasOwn(record,'duration') && (typeof record.duration !== 'number' || !Number.isFinite(record.duration) || record.duration <= 0)) issues.push(makeIssue(position,['duration','DURATION_INVALID','声明的音频时长必须为大于 0 的有限数字，单位为秒']));
  if (hasText(record.audio_file)) {
    const mediaPath = normalizeMediaPath(record.audio_file);
    if (mediaPath === null) issues.push(makeIssue(position,['audio_file','AUDIO_PATH','音频引用须为根目录内的文件名或相对路径']));
    else if (!AUDIO_SUFFIXES.has(mediaPath.split('.').pop())) issues.push(makeIssue(position,['audio_file','AUDIO_SUFFIX','音频扩展名不在演示允许列表；未验证可解码性']));
  }
  for (const issue of issues) issue.sample_id = typeof record.id === 'string' ? record.id : '';
  return issues;
}
