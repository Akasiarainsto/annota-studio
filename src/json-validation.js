import {validateTask} from './core.js';
import {parseLocatedJson,locateJsonField} from './json-parser.js';
import {toTrainingRecord,mapTrainingField} from './validation-adapters.js';
import {PROFILES,AUDIO_DIALECTS} from './validation_rules/profiles.js';
import {isObject,normalizeMediaPath,validateBatch} from './validation_rules/common.js';
import {validateImageRecord} from './validation_rules/image-rules.js';
import {validateVideoRecord} from './validation_rules/video-rules.js';
import {validateAudioRecord} from './validation_rules/audio-rules.js';

const CHECKERS={image:validateImageRecord,video:validateVideoRecord,audio:validateAudioRecord};
const MAX_INPUT_CHARS=2000000;
const MAX_RECORDS=1000;
const PARSER_CODES={syntax:'JSON_SYNTAX','duplicate-key':'DUPLICATE_KEY',number:'NUMBER_RANGE',limit:'INPUT_LIMIT'};

function detectedModality(record) {
  if(!isObject(record))return null;
  if(record.modality)return record.modality;
  return Object.hasOwn(record,'audio_file')?'audio':Object.hasOwn(record,'video_path')?'video':Object.hasOwn(record,'image_path')?'image':null;
}
function addLocatedIssue(context,issue,row={}) {
  const rawField=issue.field.replace(/\[(\d+)\]/g,'.$1');
  const mapped=row.adapted?mapTrainingField(context.modality,issue.field):rawField;
  const path=row.path?`${row.path}${mapped==='$'?'':'.'+mapped}`:mapped==='$'?'':mapped;
  const location=issue.offset!==undefined?issue:locateJsonField(row.locations||new Map(),path);
  const source=row.source??context.source;
  const offset=Math.max(0,location.offset||0);const prefix=source.slice(0,offset).split('\n');
  context.issues.push({...issue,field:path||'$',recordIndex:row.position||issue.position||0,offset:(row.baseOffset||0)+offset,length:location.length||1,line:(row.baseLine||0)+prefix.length,column:prefix.at(-1).length+1});
}
function getRecords(value,jsonl) {
  if(isObject(value)&&value.kind==='evaluation')return {error:'模型评测文件不属于训练标注 JSON，请在模型评测入口处理。'};
  if(isObject(value)&&value.schemaVersion!==undefined&&value.schemaVersion!=='annota/1')return {error:'不支持此 Annota schemaVersion。'};
  if(isObject(value)&&value.project==='dolphin'&&value.schema_version===1&&Array.isArray(value.records))return {entries:value.records.map((record,index)=>({record,path:`records.${index}`}))};
  if(isObject(value)&&Object.hasOwn(value,'tasks'))return Array.isArray(value.tasks)?{backup:true,entries:value.tasks.map((record,index)=>({record,path:`tasks.${index}`}))}:{error:'tasks 必须为数组。'};
  if(isObject(value)&&Object.hasOwn(value,'task'))return {entries:[{record:value.task,path:'task'}]};
  if(!jsonl&&Array.isArray(value))return {entries:value.map((record,index)=>({record,path:String(index)}))};
  if(jsonl||isObject(value))return {entries:[{record:value,path:''}]};
  return {error:'JSON 须为记录对象、记录数组或对应模态的数据包。'};
}
function addRecord(context,entry,sourceContext) {
  if(context.total>=MAX_RECORDS){addLocatedIssue(context,{field:'$',code:'INPUT_LIMIT',message:'一次最多校验 1000 条记录。'},sourceContext);return;}
  const position=++context.total;const modality=detectedModality(entry.record);
  const row={...sourceContext,...entry,position,adapted:isObject(entry.record)&&Object.hasOwn(entry.record,'modality')};
  if(modality&&modality!==context.modality){addLocatedIssue(context,{field:'modality',code:'MODALITY_MISMATCH',message:`当前为${PROFILES[context.modality].name}规则，文件却是${PROFILES[modality]?.name||modality}记录，请切换校验类型。`},row);return;}
  const record=row.adapted?toTrainingRecord(entry.record):entry.record;
  row.record=record;context.rows.push(row);
  for(const issue of CHECKERS[context.modality]([position,record],context.inventory))addLocatedIssue(context,issue,row);
  if(row.adapted) {
    for(const issue of validateTask({...entry.record,evaluation:{ratings:{}}}).filter(issue=>/^(regions|tracks|media\.(width|height))/.test(issue.field)))addLocatedIssue(context,{...issue,code:'SPATIAL_RULE'},{...row,adapted:false});
  }
}
function parseDocument(context,source,baseOffset=0,baseLine=0,jsonl=false) {
  const parsed=parseLocatedJson(source);
  const sourceContext={source,baseOffset,baseLine,locations:parsed.locations};
  if(parsed.issues.length){const position=jsonl?++context.total:0;for(const issue of parsed.issues)addLocatedIssue(context,{...issue,position,code:PARSER_CODES[issue.code]||issue.code},sourceContext);return;}
  const unpacked=getRecords(parsed.value,jsonl);
  if(unpacked.error){if(jsonl)context.total++;addLocatedIssue(context,{field:'$',position:jsonl?context.total:0,code:'ROOT_TYPE',message:unpacked.error},sourceContext);return;}
  for(const entry of unpacked.entries) {
    if(unpacked.backup&&isObject(entry.record)&&entry.record.modality!==context.modality){context.skipped++;continue;}
    addRecord(context,entry,sourceContext);
  }
}
export function validateAnnotationText(text,format='json',options={}) {
  const modality=options.modality||'audio';
  const context={modality,inventory:options.inventory??new Set(),source:typeof text==='string'?text:'',total:0,skipped:0,issues:[],rows:[]};
  if(!PROFILES[modality])throw new Error('Unknown validation modality');
  if(typeof text!=='string'||text.length>MAX_INPUT_CHARS)addLocatedIssue(context,{field:'$',code:'INPUT_LIMIT',message:'请输入文本，单次最多 200 万字符。'});
  else if(format==='jsonl'){let offset=0;for(const [index,line] of text.split('\n').entries()){if(line.trim())parseDocument(context,line,offset,index,true);offset+=line.length+1;}}
  else parseDocument(context,text.replace(/^\uFEFF/,' '));
  for(const issue of validateBatch(context.rows.map(row=>[row.position,row.record]),PROFILES[modality]))addLocatedIssue(context,issue,context.rows.find(row=>row.position===issue.position));
  if(!context.total&&!context.issues.length)addLocatedIssue(context,{field:'$',code:'EMPTY_DATASET',message:`没有可校验的${PROFILES[modality].name}记录。`});
  const failed=new Set(context.issues.map(issue=>issue.recordIndex).filter(Boolean)).size;
  return {ruleVersion:PROFILES[modality].version,modality,format,total:context.total,passed:context.total-failed,failed,skipped:context.skipped,valid:!context.issues.length,issues:context.issues,imageInventoryCount:modality==='image'?context.inventory.size:undefined,mediaChecked:modality==='image'?'selected_file_inventory_only':false,timeBasis:modality==='image'?undefined:'json_declared_duration'};
}
export function validateLiveTask(task) {
  const core=validateTask(task);
  if(!PROFILES[task.modality])return core;
  const record=toTrainingRecord(task);
  const native=CHECKERS[task.modality]([1,record],new Set([normalizeMediaPath(task.media?.name)]));
  const issues=native.map(issue=>({...issue,field:mapTrainingField(task.modality,issue.field)}));
  const extras=core.filter(issue=>/^(regions|tracks|reviews|media\.(width|height)|modality|status|revision|isDemo|segments\.[1-9]\d*\.language$)/.test(issue.field));
  if(task.modality==='audio'&&Array.isArray(task.segments))task.segments.forEach((segment,index)=>{
    if(!['Speech','Noise'].includes(segment.label))extras.push({field:`segments.${index}.label`,code:'KIND_ENUM',message:'片段类型只能为 Speech 或 Noise。'});
    if(segment.dialect&&!AUDIO_DIALECTS.has(segment.dialect.replace('（合成）','')))extras.push({field:`segments.${index}.dialect`,code:'DIALECT_ENUM',message:'方言属性不在约定枚举内。'});
  });
  return [...issues,...extras];
}
