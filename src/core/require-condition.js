export function requireCondition(condition,status,message,issues=[]) {
  if(!condition)throw Object.assign(new Error(message),{status,issues});
}
