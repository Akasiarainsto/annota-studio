import {isObject,hasText,makeIssue,normalizeMediaPath,validateTextFields,validateSegmentTimes} from './common.js';
import {PROFILES,IMAGE_SUFFIXES, ALLOWED_TAGS, ALLOWED_SPLITS} from './profiles.js';
const RULES=PROFILES.image;

function validateTags(position, record) {
  if (!Object.hasOwn(record, 'tags')) return [];
  if (!Array.isArray(record.tags)) return [makeIssue(position, ['tags', 'FIELD_TYPE', '必须是标签数组'])];
  if (!record.tags.length) return [makeIssue(position, ['tags', 'EMPTY_TAGS', '至少填写一个标签'])];
  const issues = [], seenTags = new Set();
  record.tags.forEach((tag, index) => {
    const field = `tags[${index}]`;
    if (typeof tag !== 'string') issues.push(makeIssue(position, [field, 'FIELD_TYPE', '标签必须是字符串']));
    else if (!ALLOWED_TAGS.has(tag)) issues.push(makeIssue(position, [field, 'TAG_ENUM', `不在演示标签集内：${tag}`]));
    else if (seenTags.has(tag)) issues.push(makeIssue(position, [field, 'DUPLICATE_TAG', `重复标签：${tag}`]));
    if (typeof tag === 'string') seenTags.add(tag);
  });
  return issues;
}

function validateImage(position, record, inventory) {
  if (!hasText(record.image_path)) return [];
  const imagePath = normalizeMediaPath(record.image_path);
  if (imagePath === null) return [makeIssue(position, ['image_path', 'IMAGE_PATH', '必须使用图片根目录内的相对路径'])];
  const issues = [];
  if (!IMAGE_SUFFIXES.has(imagePath.split('.').pop())) issues.push(makeIssue(position, ['image_path', 'IMAGE_SUFFIX', '不是演示规则允许的图片扩展名']));
  if (!inventory.has(imagePath)) issues.push(makeIssue(position, ['image_path', 'IMAGE_MISSING', '图片引用未在当前文件清单中找到']));
  return issues;
}

export function validateImageRecord(row, inventory) {
  const [position, record] = row;
  if (!isObject(record)) return [makeIssue(position, ['$', 'RECORD_TYPE', '每条记录必须是 JSON 对象'])];
  const issues = RULES.requiredFields.filter(field => !Object.hasOwn(record, field)).sort()
    .map(field => makeIssue(position, [field, 'MISSING_FIELD', '缺少必填字段']));
  issues.push(...validateTextFields(position, record, RULES), ...validateTags(position, record), ...validateImage(position, record, inventory));
  if (Object.hasOwn(record, 'split') && !ALLOWED_SPLITS.has(record.split)) issues.push(makeIssue(position, ['split', 'SPLIT_ENUM', '必须是 train / validation / test']));
  for (const issue of issues) issue.sample_id = typeof record.sample_id === 'string' ? record.sample_id : '';
  return issues;
}
