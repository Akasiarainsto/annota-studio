import {ALLOWED_SPLITS} from './profiles.js';
export const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export const hasText=value=>typeof value==='string'&&value.trim().length>0;
export const makeIssue=(position,details,sampleId='')=>({position,sample_id:sampleId,field:details[0],code:details[1],message:details[2]});
export function normalizeMediaPath(imagePath) {
  if (!hasText(imagePath) || imagePath.includes('\0')) return null;
  const portablePath = imagePath.replace(/\\/g, '/');
  if (portablePath.startsWith('/') || /^[a-z]:/i.test(portablePath)) return null;
  const segments = [];
  for (const segment of portablePath.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (!segments.length) return null;
      segments.pop();
    } else segments.push(segment);
  }
  return segments.join('/').toLowerCase();
}

export function validateTextFields(position, record, rules) {
  const issues = [];
  for (const field of rules.textFields) {
    if (!Object.hasOwn(record, field)) continue;
    const value = record[field];
    if (typeof value !== 'string') issues.push(makeIssue(position, [field, 'FIELD_TYPE', '必须是字符串']));
    else if (!value.trim()) issues.push(makeIssue(position, [field, 'EMPTY_TEXT', '不能是空文本或纯空白']));
    else if (value !== value.trim()) issues.push(makeIssue(position, [field, 'EDGE_WHITESPACE', '首尾存在空白，请人工确认后清理']));
  }
  return issues;
}

export function validateSegmentTimes(options) {
  const {segment, duration, field, position} = options;
  const issues = [];
  for (const edge of ['start', 'end']) {
    if (!Object.hasOwn(segment, edge)) issues.push(makeIssue(position, [`${field}.${edge}`, 'MISSING_FIELD', '缺少片段时间字段']));
    else if (typeof segment[edge] !== 'number' || !Number.isFinite(segment[edge])) issues.push(makeIssue(position, [`${field}.${edge}`, 'FIELD_TYPE', '片段时间必须是有限数字，单位为秒']));
  }
  if (issues.length) return issues;
  if (segment.start < 0) issues.push(makeIssue(position, [`${field}.start`, 'TIME_NEGATIVE', '开始时间不能小于 0 秒']));
  if (segment.end <= segment.start) issues.push(makeIssue(position, [`${field}.end`, 'SEGMENT_ORDER', '结束时间必须大于开始时间；请核对起止是否颠倒']));
  if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0 && Math.max(segment.start, segment.end) > duration) issues.push(makeIssue(position, [field, 'TIME_OUT_OF_BOUNDS', `片段时间超过声明的媒体时长 ${duration} 秒`]));
  return issues;
}

function addToGroup(groups, key, value) {
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(value);
}

export function validateBatch(rows, rules) {
  const idGroups = new Map(), imageGroups = new Map(), issues = [];
  for (const [position, record] of rows) {
    if (!isObject(record)) continue;
    if (hasText(record[rules.idField])) addToGroup(idGroups, record[rules.idField], position);
    if (!rules.pathField) continue;
    const imagePath = normalizeMediaPath(record[rules.pathField]);
    if (imagePath !== null && ALLOWED_SPLITS.has(record.split)) addToGroup(imageGroups, imagePath, {position, record});
  }
  for (const [sampleId, positions] of idGroups) {
    if (positions.length < 2) continue;
    for (const position of positions) issues.push(makeIssue(position, [rules.idField, 'DUPLICATE_ID', `重复 ID，位置：[${positions.join(', ')}]`], sampleId));
  }
  for (const entries of imageGroups.values()) {
    if (new Set(entries.map(entry => entry.record.split)).size < 2) continue;
    for (const {position, record} of entries) issues.push(makeIssue(position, ['split', rules.crossSplitCode, `同一规范化${rules.mediaLabel}路径出现在不同划分中`], typeof record.sample_id === 'string' ? record.sample_id : ''));
  }
  return issues;
}

