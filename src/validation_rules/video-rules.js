import {isObject,hasText,makeIssue,normalizeMediaPath,validateTextFields,validateSegmentTimes} from './common.js';
import {PROFILES,VIDEO_SUFFIXES, CAPTION_FIELDS, ALLOWED_SPLITS} from './profiles.js';
const RULES=PROFILES.video;

function validateSegmentCaptions(options) {
  const {segment, field, position} = options;
  if (!Object.hasOwn(segment, 'captions')) return [makeIssue(position, [`${field}.captions`, 'MISSING_FIELD', '缺少片段的七项描述 captions'])];
  if (!Array.isArray(segment.captions)) return [makeIssue(position, [`${field}.captions`, 'FIELD_TYPE', 'captions 必须是七项描述数组'])];
  const issues = [];
  if (segment.captions.length !== CAPTION_FIELDS.length) issues.push(makeIssue(position, [`${field}.captions`, 'CAPTION_COUNT', '每个片段必须有七项描述，顺序见规则说明']));
  segment.captions.forEach((caption, index) => {
    if (typeof caption !== 'string') issues.push(makeIssue(position, [`${field}.captions[${index}]`, 'FIELD_TYPE', '描述必须是字符串']));
    else if (!caption.trim()) issues.push(makeIssue(position, [`${field}.captions[${index}]`, 'CAPTION_MISSING', `${CAPTION_FIELDS[index] || '片段描述'}缺失；不可观察时应说明理由`]));
  });
  if (Object.hasOwn(segment, 'overlap_reason') && typeof segment.overlap_reason !== 'string') issues.push(makeIssue(position, [`${field}.overlap_reason`, 'FIELD_TYPE', '重叠原因必须是字符串']));
  return issues;
}

function validateVideoSegments(position, record) {
  if (!Object.hasOwn(record, 'segments')) return [];
  if (!Array.isArray(record.segments)) return [makeIssue(position, ['segments', 'FIELD_TYPE', 'segments 必须是片段数组'])];
  if (!record.segments.length) return [makeIssue(position, ['segments', 'EMPTY_SEGMENTS', '至少填写一个时间片段'])];
  const issues = [], validRanges = [];
  record.segments.forEach((segment, index) => {
    const field = `segments[${index}]`;
    if (!isObject(segment)) { issues.push(makeIssue(position, [field, 'SEGMENT_TYPE', '每个片段必须是对象'])); return; }
    const timeIssues = validateSegmentTimes({segment, duration:record.duration, field, position});
    issues.push(...timeIssues, ...validateSegmentCaptions({segment, field, position}));
    if (timeIssues.length) return;
    const overlaps = validRanges.some(previous => segment.start < previous.end && segment.end > previous.start);
    if (overlaps && !hasText(segment.overlap_reason)) issues.push(makeIssue(position, [`${field}.overlap_reason`, 'OVERLAP_REASON', '片段重叠时必须说明原因；相邻片段首尾相接不算重叠']));
    validRanges.push(segment);
  });
  return issues;
}

export function validateVideoRecord(row) {
  const [position, record] = row;
  if (!isObject(record)) return [makeIssue(position, ['$', 'RECORD_TYPE', '每条记录必须是 JSON 对象'])];
  const issues = RULES.requiredFields.filter(field => !Object.hasOwn(record, field)).sort()
    .map(field => makeIssue(position, [field, 'MISSING_FIELD', '缺少必填字段']));
  issues.push(...validateTextFields(position, record, RULES), ...validateVideoSegments(position, record));
  if (Object.hasOwn(record, 'duration') && (typeof record.duration !== 'number' || !Number.isFinite(record.duration) || record.duration <= 0)) issues.push(makeIssue(position, ['duration', 'DURATION_INVALID', '声明的视频时长必须是大于 0 的有限数字，单位为秒']));
  if (hasText(record.video_path)) {
    const mediaPath = normalizeMediaPath(record.video_path);
    if (mediaPath === null) issues.push(makeIssue(position, ['video_path', 'VIDEO_PATH', '必须使用根目录内的相对视频路径']));
    else if (!VIDEO_SUFFIXES.has(mediaPath.split('.').pop())) issues.push(makeIssue(position, ['video_path', 'VIDEO_SUFFIX', '视频扩展名应为 mp4 / webm / mov / mkv / avi；未验证可解码性']));
  }
  if (Object.hasOwn(record, 'split') && !ALLOWED_SPLITS.has(record.split)) issues.push(makeIssue(position, ['split', 'SPLIT_ENUM', '必须是 train / validation / test']));
  for (const issue of issues) issue.sample_id = typeof record.sample_id === 'string' ? record.sample_id : '';
  return issues;
}
