import {readFileSync} from 'node:fs';
import {join} from 'node:path';

function makeTask(doc, options) {
  return {id:doc.task_id,label:options.label,modality:doc.modality,objective:options.objective,difficulty:options.difficulty||'常规',
    media:doc.media,draft:doc,reference:options.reference||null,modelOriginal:options.modelOriginal||null,source:options.source,
    assignee:'annotator',status:'draft',version:1,round:0,rounds:[],reviews:[],events:[],updatedAt:new Date().toISOString()};
}
function audioTask(root) {
  const doc=JSON.parse(readFileSync(join(root,'docs/audio_reference_draft.json'),'utf8'));
  const original=JSON.parse(readFileSync(join(root,'docs/audio_model_original.json'),'utf8'));
  doc.media={...doc.media,url:'/assets/audio/D11_766.wav'};delete doc.media.file;delete doc.status;
  doc.segments.forEach(segment=>{segment.quality='clear';segment.note='';segment.revision_reason='';});
  const reference=structuredClone(doc);
  doc.segments[1].transcript=doc.segments[1].transcript.replace('滩','胎');
  doc.segments[2].transcript=doc.segments[2].transcript.replace('张','章');
  return makeTask(doc,{label:'宁夏畜牧业 · 句段转写',objective:'复听三段，核对同音字并确认句段边界。保留原始机器稿，不凭常识改写罕见术语。',reference,modelOriginal:original.text,source:{name:'THCHS-30 · Apache 2.0',url:'https://www.openslr.org/18/'}});
}
function videoTask(root,caseId) {
  const main=JSON.parse(readFileSync(join(root,'docs/video_caption_reference_draft.json'),'utf8'));
  const isMain=caseId==='case2';
  const doc={schema_version:'1.0',modality:'video',task_id:isMain?'V-001':'V-002',media:{id:caseId+'-veo',url:`/assets/video/${caseId}_veo3_1_fast.mp4`,duration_s:8,fps:24},segments:[]};
  const tuples=isMain?[['person','contact','uncertain','lowlight','suspect','mixed','contact'],['vehicle','moving','uncertain','lowlight','uncertain','metal','occlusion'],['object','moving','uncertain','colored','uncertain','uncertain','contact'],['text','changing','not_applicable','graphic','not_applicable','graphic','none']]:[['object','changing','fixed','studio','uncertain','glass','contact']];
  const keys=['subject','action','camera','lighting','physical_dynamics','material','interaction'];
  const segments=isMain?main.segments:[{id:'VS01',start_s:0,end_s:8,caption:'透明烧杯内的液体受搅拌产生旋涡，颜色在浅色、黄褐色与深蓝色之间变化。'}];
  doc.segments=segments.map((segment,index)=>({id:segment.id,start_s:segment.start_s,end_s:segment.end_s,caption:segment.caption,dimensions:Object.fromEntries(keys.map((key,i)=>[key,tuples[index][i]])),note:'部分运镜、物理动态与材质需要连续观看确认；不从单帧推断。',boundary_status:'pending_listen'}));
  return makeTask(doc,{label:isMain?'行动预告 · 多镜头 Caption':'烧杯变色 · 动态过程',objective:isMain?'描述画面实际发生的动作，逐段核对七维属性；不能照提示词补写不存在的情节。':'连续观察颜色变化和搅拌过程，不把好看的单帧当成过程遵循证据。',reference:structuredClone(doc),source:{name:'Microsoft AVGen-Bench · '+caseId,url:'https://microsoft.github.io/AVGen-Bench/'}});
}
function imageTask() {
  const doc={schema_version:'1.0',modality:'image',task_id:'I-001',media:{id:'street-market',url:'/assets/images/street_market.jpg',width:1920,height:1440},caption:'树荫覆盖的街道上有多名行人。右侧店铺前陈列着帽子，一名戴浅色宽檐帽的成年人站在一名儿童后方；前方另一名白衣行人正沿街走来。',scene:'market',lighting:'daylight',tags:['person','goods','building'],boxes:[],content_confirmed:false};
  return makeTask(doc,{label:'街边市集 · 遮挡与主体区域',objective:'核对 Caption 和标签，至少框出一位人物。按可见区域画框，标明遮挡，不推断身份或人物关系。',source:{name:'U.S. Fish and Wildlife Service / Wikimedia Commons · Public domain',url:'https://commons.wikimedia.org/wiki/File:People_on_street_market_in_urban_part_of_town.jpg'}});
}
export function seedTasks(store, root) {
  for (const task of [audioTask(root),videoTask(root,'case2'),videoTask(root,'case4'),imageTask()]) store.addTask(task);
}
