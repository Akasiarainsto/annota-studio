import {parseLocatedJson,locateJsonField} from './json-parser.js';
import {validateDocument} from './validation.js';

export function inspectJsonText(text) {
  const whole=parseLocatedJson(text);let chunks;
  if (!whole.issues.some(error=>error.code==='syntax')) chunks=[{text,offset:0,parsed:whole}];
  else {
    const lines=text.split('\n');const nonempty=lines.filter(line=>line.trim());
    if(nonempty.length>1&&nonempty.every(line=>line.trim().startsWith('{'))) {
      let offset=0;chunks=lines.map(line=>{const item={text:line,offset};offset+=line.length+1;return item;}).filter(item=>item.text.trim());
    } else chunks=[{text,offset:0,parsed:whole}];
  }
  const errors=[],records=[],seen=new Set();
  for(const chunk of chunks) {
    const parsed=chunk.parsed||parseLocatedJson(chunk.text);
    for(const error of parsed.issues) errors.push({...error,path:'/'+error.field.replaceAll('.','/'),code:'E_JSON_'+error.code.toUpperCase(),offset:chunk.offset+error.offset});
    if(parsed.issues.length)continue;
    const docs=Array.isArray(parsed.value)?parsed.value:[parsed.value];
    docs.forEach((doc,index)=>{
      records.push(doc);
      const findings=validateDocument(doc);
      if(doc?.task_id&&seen.has(doc.task_id))findings.push({path:'/task_id',code:'E_DUPLICATE_TASK_ID',message:'批量文件中的任务 ID 重复'});
      if(doc?.task_id)seen.add(doc.task_id);
      for(const error of findings) {
        const dotted=error.path.replace(/^\//,'').replaceAll('/','.');
        const location=locateJsonField(parsed.locations,(Array.isArray(parsed.value)?index+'.':'')+dotted);
        errors.push({...error,record:records.length,offset:chunk.offset+location.offset,length:location.length});
      }
    });
  }
  if(!records.length&&!errors.length)errors.push({path:'/',code:'E_EMPTY_BATCH',message:'至少提供一条标注记录',offset:0,length:1});
  errors.forEach(error=>{const before=text.slice(0,error.offset);error.line=before.split('\n').length;error.column=before.length-before.lastIndexOf('\n');});
  return {records,issues:errors,valid:errors.length===0,format:chunks.length>1?'jsonl':'json'};
}
