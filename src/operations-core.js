export const QC_LABELS=Object.freeze(['pass','fail']);
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export function getClipRange({start,duration,clipSeconds}) {
  if(!Number.isInteger(clipSeconds)||clipSeconds<3||clipSeconds>10)return {ok:false,message:'快捷片段长度须为 3–10 秒整数。'};
  if(!Number.isFinite(start)||!Number.isFinite(duration)||start<0||start+clipSeconds>duration+0.001)return {ok:false,message:'当前位置的剩余媒体不足所选时长，请前移或选择更短片段。'};
  return {ok:true,start:Number(start.toFixed(3)),end:Number(Math.min(start+clipSeconds,duration).toFixed(3))};
}
export function calculateKappa(pairs) {
  const counts=[[0,0],[0,0]];
  for(const pair of pairs) {
    const left=QC_LABELS.indexOf(pair[0]),right=QC_LABELS.indexOf(pair[1]);
    if(left>=0&&right>=0)counts[left][right]++;
  }
  const n=counts.flat().reduce((sum,count)=>sum+count,0);
  if(!n)return {n:0,counts,po:null,pe:null,kappa:null,reason:'暂无有效双人配对判断'};
  const po=(counts[0][0]+counts[1][1])/n;
  const pe=((counts[0][0]+counts[0][1])*(counts[0][0]+counts[1][0])+(counts[1][0]+counts[1][1])*(counts[0][1]+counts[1][1]))/(n*n);
  return {n,counts,po,pe,kappa:pe===1?null:(po-pe)/(1-pe),reason:pe===1?'判断集中于同一类别，Pe=1，Kappa 不可计算':null};
}
function createRandom(seed) {
  let value=2166136261;
  for(const character of String(seed))value=Math.imul(value^character.charCodeAt(0),16777619);
  return ()=>{value+=0x6D2B79F5;let mixed=Math.imul(value^(value>>>15),1|value);mixed^=mixed+Math.imul(mixed^(mixed>>>7),61|mixed);return ((mixed^(mixed>>>14))>>>0)/4294967296;};
}
export function sampleStrata(tasks,{field,rate,seed}) {
  if(!['modality','difficulty','assignee_id'].includes(field)||!Number.isFinite(rate)||rate<=0||rate>1)throw new Error('抽样分层字段或比例无效');
  const random=createRandom(seed),groups=new Map();
  for(const task of [...tasks].sort((left,right)=>left.id.localeCompare(right.id))) {
    const key=String(task[field]||'未设置');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(task);
  }
  return [...groups.entries()].sort(([left],[right])=>left.localeCompare(right)).map(([stratum,entries])=>{
    for(let index=entries.length-1;index>0;index--){const selected=Math.floor(random()*(index+1));[entries[index],entries[selected]]=[entries[selected],entries[index]];}
    const size=clamp(Math.ceil(entries.length*rate),1,entries.length);
    return {stratum,population:entries.length,sampleSize:size,tasks:entries.slice(0,size)};
  });
}
export function summarizePeople({members,tasks,sessions,events=[],votes=[]}) {
  const taskIds=new Set(tasks.map(task=>task.id));
  return members.map(member=>{
    const assigned=tasks.filter(task=>task.assignee_id===member.user_id);
    const approved=assigned.filter(task=>task.status==='approved').length;
    const delivered=tasks.filter(task=>task.status==='approved'&&task.submitted_by===member.user_id).length;
    const submitted=new Set(events.filter(event=>taskIds.has(event.task_id)&&event.kind==='submit'&&event.actor_id===member.user_id).map(event=>event.task_id)).size;
    const returned=new Set(events.filter(event=>taskIds.has(event.task_id)&&event.kind==='returned'&&event.meta.submitted_by===member.user_id).map(event=>event.task_id)).size;
    const work=sessions.filter(session=>session.user_id===member.user_id&&taskIds.has(session.task_id));
    const annotationSeconds=work.filter(session=>session.work_type!=='review').reduce((sum,session)=>sum+Number(session.seconds||0),0);
    const reviewSeconds=work.filter(session=>session.work_type==='review').reduce((sum,session)=>sum+Number(session.seconds||0),0);
    const reviewed=votes.filter(vote=>vote.reviewer_id===member.user_id&&taskIds.has(vote.task_id)).length;
    return {...member,assigned:assigned.length,approved,delivered,submitted,returned,seconds:annotationSeconds+reviewSeconds,annotationSeconds,reviewSeconds,reviewed,progress:assigned.length?approved/assigned.length:null,reworkRate:submitted?returned/submitted:null,tasksPerHour:annotationSeconds>0?delivered*3600/annotationSeconds:null,reviewsPerHour:reviewSeconds>0?reviewed*3600/reviewSeconds:null};
  });
}
