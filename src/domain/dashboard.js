import {calculateKappa,getActiveReviews} from '../core/quality.js';

export function buildDashboard(store) {
  const tasks=store.listTasks();
  const pairs=tasks.flatMap(task=>{
    const complete=task.rounds.filter(round=>!round.supersededBy&&!(task.status==='correction_pending'&&round.round===task.round)).map(round=>getActiveReviews(task,round.round)).filter(reviews=>reviews.length===2);
    const latest=complete.at(-1);return latest?[latest.sort((a,b)=>a.reviewer.localeCompare(b.reviewer)).map(review=>review.decision)]:[];
  });
  const members=store.listUsers().map(user=>{
    const assigned=tasks.filter(task=>task.assignee===user.id);const timer=store.getTimer(user.id);
    const seconds=Object.values(timer?.totals||{}).reduce((sum,value)=>sum+value,0)/1000;
    const submitted=assigned.filter(task=>task.round>0).length;
    const reworked=assigned.filter(task=>task.events.some(event=>event.kind==='submit'&&event.round>1)).length;
    const mediaSeconds=assigned.filter(task=>task.round>0).reduce((sum,task)=>sum+(task.media.duration_s||0),0);
    return {...user,assigned:assigned.length,submitted,accepted:assigned.filter(task=>task.status==='approved').length,returned:assigned.filter(task=>task.status==='returned').length,reworked,seconds,mediaSeconds,reworkRate:submitted?reworked/submitted:null};
  });
  const modalitySeconds={audio:0,video:0,image:0};
  for(const timer of store.listTimers())for(const [id,milliseconds] of Object.entries(timer.totals)){const task=tasks.find(item=>item.id===id);if(task)modalitySeconds[task.modality]+=milliseconds/1000;}
  return {tasks:tasks.map(task=>({id:task.id,label:task.label,modality:task.modality,status:task.status,assignee:task.assignee,round:task.round})),members,modalitySeconds,kappa:calculateKappa(pairs)};
}
