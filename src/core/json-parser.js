const TOKEN_PATTERN=/"(?:\\.|[^"\\])*"|[{}\[\]:,]|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g;
const MAX_DEPTH=80;

function inspectValue(context,path,depth=0) {
  if(depth>MAX_DEPTH)throw new Error('嵌套超过 80 层，请简化数据结构');
  const token=context.tokens[context.cursor++];
  context.locations.set(path,{offset:token.index,length:token[0].length});
  if(token[0]==='{')inspectObject(context,path,depth);
  else if(token[0]==='[')inspectArray(context,path,depth);
  else if(/^-?\d/.test(token[0])&&!Number.isFinite(Number(token[0])))context.issues.push({code:'number',field:path,message:'数值超出浏览器可表示的有限范围',offset:token.index,length:token[0].length});
}
function inspectObject(context,path,depth) {
  const keys=new Set();
  while(context.tokens[context.cursor][0]!=='}') {
    const token=context.tokens[context.cursor++];
    const key=JSON.parse(token[0]);
    const childPath=path?`${path}.${key}`:key;
    if(keys.has(key))context.issues.push({code:'duplicate-key',field:childPath,message:`对象内出现重复字段“${key}”，后值会覆盖前值`,offset:token.index,length:token[0].length});
    keys.add(key);context.cursor++;inspectValue(context,childPath,depth+1);
    if(context.tokens[context.cursor][0]===',')context.cursor++;
  }
  context.cursor++;
}
function inspectArray(context,path,depth) {
  let index=0;
  while(context.tokens[context.cursor][0]!==']') {
    inspectValue(context,path?`${path}.${index}`:String(index),depth+1);index++;
    if(context.tokens[context.cursor][0]===',')context.cursor++;
  }
  context.cursor++;
}
export function parseLocatedJson(text) {
  let value;
  try{value=JSON.parse(text);}catch(error){
    const position=error.message.match(/position\s+(\d+)/)?.[1];
    return {value:null,locations:new Map(),issues:[{code:'syntax',field:'$',message:`JSON 语法错误：${error.message}`,offset:Number(position || 0),length:1}]};
  }
  const context={tokens:[...text.matchAll(TOKEN_PATTERN)],cursor:0,locations:new Map(),issues:[]};
  try{inspectValue(context,'');}catch(error){context.issues.push({code:'limit',field:'$',message:error.message,offset:0,length:1});}
  return {value,locations:context.locations,issues:context.issues};
}
export function locateJsonField(locations,field) {
  let parent=field;
  while(!locations.has(parent)&&parent.includes('.'))parent=parent.slice(0,parent.lastIndexOf('.'));
  return locations.get(parent) || locations.get('') || {offset:0,length:1};
}
