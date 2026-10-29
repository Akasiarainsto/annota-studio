import {validateReviewState} from './review-workflow.js';

export const STATUS_LABELS = Object.freeze({
  draft: '草稿', pending: '待质检', approved: '已验收', returned: '已退回', disputed: '待仲裁',
});

const MODALITIES = new Set(['audio', 'image', 'video']);
const SPLITS = new Set(['train', 'validation', 'test']);
const DESCRIPTION_FIELDS = ['subject', 'action', 'camera', 'lighting', 'physics', 'material', 'interaction'];
const BOX_FIELDS = ['x', 'y', 'width', 'height'];
const MAX_TASKS = 1000;
const MAX_ITEMS = 2000;
const MAX_TEXT_LENGTH = 100000;
const TIME_TOLERANCE = 0.001;
const SINGLE_FRAME_TOLERANCE = 0.04;

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = value => typeof value === 'string' && value.length <= MAX_TEXT_LENGTH;
const hasText = value => isText(value) && value.trim().length > 0;
const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const isBoundedArray = value => Array.isArray(value) && value.length <= MAX_ITEMS;
const createIssue = (field, message) => ({ field, message });

function validateBox(box, field) {
  if (!isObject(box) || !BOX_FIELDS.every(key => isFiniteNumber(box[key]))) {
    return [createIssue(field, '标注框坐标必须是有限数值')];
  }
  const { x, y, width, height } = box;
  return x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 + Number.EPSILON || y + height > 1 + Number.EPSILON
    ? [createIssue(field, '标注框必须位于图片范围内，且宽高大于零')]
    : [];
}

function validateOptionalText(object, keys, field) {
  return keys.filter(key => object[key] !== undefined && !isText(object[key]))
    .map(key => createIssue(`${field}.${key}`, '文字字段必须是字符串，且长度不能超过 100000 字符'));
}

function validateCollectionShapes(task) {
  const issues = [];
  for (const key of ['tags', 'segments', 'regions', 'tracks', 'reviews']) {
    if (!isBoundedArray(task[key])) issues.push(createIssue(key, '必须是数组，且最多包含 2000 项'));
  }
  if (issues.length) return issues;
  if (!task.tags.every(isText)) issues.push(createIssue('tags', '每个标签必须是字符串'));
  for (const key of ['segments', 'regions', 'tracks', 'reviews']) {
    if (!task[key].every(isObject)) issues.push(createIssue(key, '数组中的每一项必须是对象'));
  }
  if (issues.length) return issues;
  task.reviews.forEach((review, index) => {
    issues.push(...validateOptionalText(review, ['id', 'reviewer', 'name', 'decision', 'note', 'reason', 'at', 'createdAt', 'updatedAt'], `reviews.${index}`));
    if (review.revision !== undefined && (!Number.isSafeInteger(review.revision) || review.revision < 0)) issues.push(createIssue(`reviews.${index}.revision`, '审核版本须为非负整数'));
  });
  return issues;
}

function validateTaskShape(task) {
  if (!isObject(task)) return [createIssue('task', '任务必须是对象')];
  const issues = validateOptionalText(task, ['title', 'caption'], 'task');
  if (task.updatedAt !== null && task.updatedAt !== undefined && !isText(task.updatedAt)) issues.push(createIssue('updatedAt', '更新时间须为字符串或 null'));
  if (!hasText(task.id)) issues.push(createIssue('id', '任务 ID 必须是非空字符串'));
  if (!MODALITIES.has(task.modality)) issues.push(createIssue('modality', '媒体类型必须是 audio、image 或 video'));
  if (!Object.hasOwn(STATUS_LABELS, task.status)) issues.push(createIssue('status', '任务状态不合法'));
  if (!SPLITS.has(task.split)) issues.push(createIssue('split', '数据划分必须是 train、validation 或 test'));
  if (!Number.isSafeInteger(task.revision) || task.revision < 0) issues.push(createIssue('revision', '修订号必须是非负整数'));
  if (typeof task.isDemo !== 'boolean') issues.push(createIssue('isDemo', '模拟样本标记必须是布尔值'));
  issues.push(...validateMediaShape(task.media), ...validateCollectionShapes(task));
  issues.push(...validateReviewState(task));
  if (!isObject(task.evaluation)) issues.push(createIssue('evaluation', '评测数据必须是对象'));
  else issues.push(...validateEvaluationShape(task.evaluation));
  return issues;
}

function validateMediaShape(media) {
  if (!isObject(media)) return [createIssue('media', '媒体元数据必须是对象')];
  const issues = validateOptionalText(media, ['name', 'url', 'source'], 'media');
  for (const key of ['duration', 'width', 'height']) {
    if (media[key] !== null && media[key] !== undefined && (!isFiniteNumber(media[key]) || media[key] < 0)) {
      issues.push(createIssue(`media.${key}`, '媒体时长和尺寸必须是非负有限数值或 null'));
    }
  }
  if (media.imported !== undefined && typeof media.imported !== 'boolean') issues.push(createIssue('media.imported', '导入标记必须是布尔值'));
  return issues;
}

function validateEvaluationShape(evaluation) {
  const issues = validateOptionalText(evaluation, ['asrOriginal', 'reference', 'outcome', 'notes', 'comparisonUrl', 'prompt'], 'evaluation');
  if (!isObject(evaluation.ratings)) return [...issues, createIssue('evaluation.ratings', '分项评分必须是对象')];
  if (Object.keys(evaluation.ratings).length > MAX_ITEMS) issues.push(createIssue('evaluation.ratings', '分项评分数量过多'));
  for (const [key, value] of Object.entries(evaluation.ratings)) {
    if (value !== '' && value !== null && value !== 'na' && value !== 'N/A' && (!isFiniteNumber(value) || value < 1 || value > 5)) {
      issues.push(createIssue(`evaluation.ratings.${key}`, '评分须为 1 至 5，或空值 / N/A'));
    }
  }
  return issues;
}

function validateSegmentShapes(task) {
  const issues = [];
  for (const [index, segment] of task.segments.entries()) {
    const field = `segments.${index}`;
    issues.push(...validateOptionalText(segment, ['id', 'text', 'speaker', 'language', 'dialect', 'scene', 'label'], field));
    for (const key of ['start', 'end']) {
      if (segment[key] !== null && segment[key] !== undefined && (!isFiniteNumber(segment[key]) || segment[key] < 0)) {
        issues.push(createIssue(`${field}.${key}`, '片段时间必须是非负有限数值或 null'));
      }
    }
    if (segment.mixed !== undefined && typeof segment.mixed !== 'boolean') issues.push(createIssue(`${field}.mixed`, '混说标记必须是布尔值'));
    if (segment.description !== undefined && !isObject(segment.description)) issues.push(createIssue(`${field}.description`, '分段描述必须是对象'));
    else if (segment.description) issues.push(...validateOptionalText(segment.description, DESCRIPTION_FIELDS, `${field}.description`));
  }
  return issues;
}

function validateSpatialShapes(task) {
  const issues = [];
  for (const [index, region] of task.regions.entries()) {
    issues.push(...validateOptionalText(region, ['id', 'label'], `regions.${index}`), ...validateBox(region, `regions.${index}`));
  }
  for (const [index, track] of task.tracks.entries()) {
    const field = `tracks.${index}`;
    issues.push(...validateOptionalText(track, ['id', 'label'], field));
    if (!isBoundedArray(track.keyframes)) { issues.push(createIssue(`${field}.keyframes`, '轨迹关键帧必须是数组，且最多 2000 项')); continue; }
    const times = new Set();
    for (const [frameIndex, frame] of track.keyframes.entries()) {
      const frameField = `${field}.keyframes.${frameIndex}`;
      issues.push(...validateBox(frame, frameField));
      if (!isObject(frame) || !isFiniteNumber(frame.time) || frame.time < 0) issues.push(createIssue(`${frameField}.time`, '关键帧时间必须是非负有限数值'));
      else if (times.has(frame.time)) issues.push(createIssue(`${frameField}.time`, '同一轨迹不能存在重复时间的关键帧'));
      else times.add(frame.time);
    }
  }
  return issues;
}

function validateSegmentContent(task) {
  const issues = [];
  if (!isFiniteNumber(task.media.duration) || task.media.duration <= 0) return [createIssue('media.duration', '请先载入媒体以读取有效时长')];
  if (!task.segments.length) issues.push(createIssue('segments', '请至少添加一个标注片段'));
  for (const [index, segment] of task.segments.entries()) {
    const field = `segments.${index}`;
    if (!isFiniteNumber(segment.start) || !isFiniteNumber(segment.end) || segment.start < 0 || segment.end <= segment.start || segment.end > task.media.duration + TIME_TOLERANCE) {
      issues.push(createIssue(`${field}.end`, '片段须满足 0 ≤ 起点 < 终点 ≤ 媒体时长'));
    }
    if (task.modality === 'audio' && !(typeof segment.label === 'string' && segment.label.toLowerCase() === 'noise')) {
      for (const [key, label] of [['text', '转写'], ['speaker', '说话人'], ['language', '语种']]) {
        if (!hasText(segment[key])) issues.push(createIssue(`${field}.${key}`, `请填写${label}`));
      }
    }
    if (task.modality === 'video') {
      for (const key of DESCRIPTION_FIELDS) {
        if (!hasText(segment.description?.[key])) issues.push(createIssue(`${field}.description.${key}`, '请填写该项观察，无法判断时说明原因'));
      }
    }
  }
  return issues;
}

/** Submission rules apply to annotations, never to independent model evaluation. */
export function validateTask(task) {
  const issues = validateTaskShape(task);
  if (issues.length) return issues;
  issues.push(...validateSegmentShapes(task), ...validateSpatialShapes(task));
  if (task.modality === 'image') {
    if (!hasText(task.caption)) issues.push(createIssue('caption', '请填写图片描述 Caption'));
    if (!task.tags.some(hasText)) issues.push(createIssue('tags', '请至少选择一个标签'));
    task.regions.forEach((region, index) => {
      if (!hasText(region.label)) issues.push(createIssue(`regions.${index}.label`, '请为标注框选择标签'));
    });
  } else issues.push(...validateSegmentContent(task));
  task.tracks.forEach((track, index) => {
    if (!hasText(track.label)) issues.push(createIssue(`tracks.${index}.label`, '请为轨迹填写标签'));
    if (!track.keyframes?.length) issues.push(createIssue(`tracks.${index}.keyframes`, '轨迹至少需要一个关键帧'));
    if (Array.isArray(track.keyframes) && isFiniteNumber(task.media.duration)) {
      track.keyframes.forEach((frame, frameIndex) => {
        if (isObject(frame) && frame.time > task.media.duration + TIME_TOLERANCE) issues.push(createIssue(`tracks.${index}.keyframes.${frameIndex}.time`, '关键帧不能超过媒体时长'));
      });
    }
  });
  return issues;
}

/** Backups may contain incomplete drafts, but every restored field has a safe type. */
export function validateBackup(value) {
  if (!isObject(value) || value.schemaVersion !== 'annota/1') return [createIssue('schemaVersion', '需要 annota/1 格式的工作台备份')];
  if (!Array.isArray(value.tasks) || value.tasks.length > MAX_TASKS) return [createIssue('tasks', '备份任务须为数组，且不超过 1000 条')];
  const issues = [];
  const ids = new Set();
  for (const [index, task] of value.tasks.entries()) {
    const taskIssues = validateTaskShape(task);
    if (!taskIssues.length) taskIssues.push(...validateSegmentShapes(task), ...validateSpatialShapes(task));
    if (!taskIssues.length && ['pending', 'approved', 'disputed'].includes(task.status)) taskIssues.push(...validateTask(task));
    if (isObject(task) && ids.has(task.id)) taskIssues.push(createIssue('id', '备份中任务 ID 重复'));
    if (isObject(task)) ids.add(task.id);
    issues.push(...taskIssues.map(issue => createIssue(`tasks.${index}.${issue.field}`, issue.message)));
  }
  return issues;
}

function normalizeCharacters(text) {
  return Array.from(text.replace(/[\p{P}\s]/gu, ''));
}

/** Each caller explicitly supplies the reference and the output being checked. */
export function calculateCer(reference, hypothesis) {
  if (!isText(reference) || !isText(hypothesis)) return null;
  const referenceChars = normalizeCharacters(reference);
  const hypothesisChars = normalizeCharacters(hypothesis);
  if (!referenceChars.length) return null;
  let previousRow = Array.from({ length: hypothesisChars.length + 1 }, (_, index) => index);
  for (let row = 1; row <= referenceChars.length; row += 1) {
    const currentRow = [row];
    for (let column = 1; column <= hypothesisChars.length; column += 1) {
      const substitution = previousRow[column - 1] + Number(referenceChars[row - 1] !== hypothesisChars[column - 1]);
      currentRow[column] = Math.min(previousRow[column] + 1, currentRow[column - 1] + 1, substitution);
    }
    previousRow = currentRow;
  }
  const distance = previousRow[hypothesisChars.length];
  return { distance, referenceLength: referenceChars.length, rate: distance / referenceChars.length };
}

function interpolateBoxes(start, end, ratio) {
  return Object.fromEntries(BOX_FIELDS.map(key => [key, start[key] + (end[key] - start[key]) * ratio]));
}

export function interpolateTrack(track, time) {
  if (!isObject(track) || !Array.isArray(track.keyframes) || !isFiniteNumber(time)) return null;
  const frames = [...track.keyframes];
  if (!frames.length || frames.some(frame => !isObject(frame) || !isFiniteNumber(frame.time) || validateBox(frame, '').length)) return null;
  if (new Set(frames.map(frame => frame.time)).size !== frames.length) return null;
  frames.sort((start, end) => start.time - end.time);
  if (frames.length === 1) return Math.abs(time - frames[0].time) <= SINGLE_FRAME_TOLERANCE + Number.EPSILON ? interpolateBoxes(frames[0], frames[0], 0) : null;
  if (time < frames[0].time || time > frames.at(-1).time) return null;
  const endIndex = frames.findIndex(frame => frame.time >= time);
  if (endIndex === 0) return interpolateBoxes(frames[0], frames[0], 0);
  const start = frames[endIndex - 1];
  const end = frames[endIndex];
  if (end.time === start.time) return null;
  return interpolateBoxes(start, end, (time - start.time) / (end.time - start.time));
}

/** Optional timestamp keeps tests deterministic; the app may omit it for the current time. */
export function markEdited(task, updatedAt = new Date().toISOString()) {
  return { ...task, revision: task.revision + 1, status: 'draft', updatedAt };
}

export function getAnnotationSnapshot(task) {
  const snapshot = structuredClone(task);
  delete snapshot.evaluation;
  if (snapshot.media) delete snapshot.media.url;
  return snapshot;
}
