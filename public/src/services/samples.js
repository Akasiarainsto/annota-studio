import {clone} from '../core/segments.js';
export function makeValidExample(task) {
  const doc=clone(task.reference||task.draft);
  if(doc.segments)doc.segments.forEach(segment=>{segment.boundary_status='confirmed';});
  if(doc.modality==='image') {
    doc.caption='树荫覆盖的街道上有多名行人，右侧店铺前陈列帽子，一名戴浅色帽子的成年人站在儿童后方。';doc.scene='market';doc.lighting='daylight';doc.tags=['person','goods','building'];
    doc.boxes=[{id:'B01',x:820,y:625,width:225,height:510,label:'person',occluded:false}];doc.content_confirmed=true;
  }
  return doc;
}
export const ERROR_CASES={
  audio:[['range','时间越界'],['speaker','说话人未定义'],['text','转写为空']],
  video:[['range','镜头越界'],['dimensions','七维缺失'],['overlap','镜头重叠']],
  image:[['range','坐标越界'],['tags','非法标签'],['text','Caption 为空']]
};
export function makeInvalidExample(task,kind) {
  const doc=makeValidExample(task);
  if(doc.modality==='audio') {
    if(kind==='range')doc.segments.at(-1).end_s=doc.media.duration_s+.542;
    if(kind==='speaker')doc.segments[0].speaker_id='UNDEFINED';
    if(kind==='text')doc.segments[0].transcript='';
  }
  if(doc.modality==='video') {
    if(kind==='range')doc.segments.at(-1).end_s=doc.media.duration_s+.5;
    if(kind==='dimensions')delete doc.segments[0].dimensions;
    if(kind==='overlap'){if(doc.segments.length<2)doc.segments.push({...clone(doc.segments[0]),id:'VS02'});doc.segments[1].start_s=doc.segments[0].start_s;}
  }
  if(doc.modality==='image') {
    if(kind==='range')doc.boxes[0].x=doc.media.width-10;
    if(kind==='tags')doc.tags=['undefined_tag'];
    if(kind==='text')doc.caption='';
  }
  return doc;
}
