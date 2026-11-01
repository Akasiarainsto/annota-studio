export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const hasText = value => typeof value === 'string' && value.trim().length > 0;
export const isNumber = value => typeof value === 'number' && Number.isFinite(value);
export const issue = (path, code, message) => ({path, code, message});
export function checkText(value, path, issues) {
  if (!hasText(value)) issues.push(issue(path, 'E_REQUIRED', '请填写非空文字'));
}
export function checkEnum(value, options, path, issues) {
  if (!options.includes(value)) issues.push(issue(path, 'E_ENUM', `可选值：${options.join(' / ')}`));
}
export function checkIds(items, path, issues) {
  const seen = new Set();
  items.forEach((item, index) => {
    if (!isObject(item)) return issues.push(issue(`${path}/${index}`, 'E_OBJECT', '记录须为对象'));
    checkText(item.id, `${path}/${index}/id`, issues);
    if (seen.has(item.id)) issues.push(issue(`${path}/${index}/id`, 'E_DUPLICATE_ID', 'ID 重复'));
    seen.add(item.id);
  });
}
export function checkTime(segment, options, issues) {
  const {path, duration, code} = options;
  if (!isNumber(segment.start_s) || !isNumber(segment.end_s)) {
    issues.push(issue(path, 'E_TIME_TYPE', '起止时间须为有限数值（秒）')); return;
  }
  if (segment.start_s < 0) issues.push(issue(`${path}/start_s`, code, '开始时间不能小于 0'));
  if (segment.end_s <= segment.start_s) issues.push(issue(`${path}/end_s`, 'E_TIME_ORDER', '结束时间须大于开始时间'));
  if (segment.end_s > duration) issues.push(issue(`${path}/end_s`, code, `结束 ${segment.end_s.toFixed(3)} > 媒体 ${duration.toFixed(3)} 秒`));
}
