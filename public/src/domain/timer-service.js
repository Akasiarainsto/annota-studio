import {requireCondition} from '../core/require-condition.js';
const MAX_GAP_MS=60000;
function accrue(timer,now) {
  if (!timer?.active) return;
  const delta=Math.max(0,Math.min(MAX_GAP_MS,now-timer.last));
  timer.totals[timer.taskId]=(timer.totals[timer.taskId]||0)+delta;
  if (now-timer.last>MAX_GAP_MS) timer.active=false;
  timer.last=now;
}
export function createTimerService(store) {
  return {
    update:(user,body)=>{
      const now=Date.now();const timer=store.getTimer(user.id)||{active:false,taskId:null,last:now,totals:{}};
      accrue(timer,now);
      if (body.action==='start') {
        const task=store.getTask(body.taskId);requireCondition(task&&task.assignee===user.id&&['draft','returned'].includes(task.status),403,'只有当前标注员能为可编辑任务开始计时');
        timer.taskId=body.taskId;timer.active=true;timer.last=now;
      }
      if (body.action==='stop') timer.active=false;
      store.saveTimer(user.id,timer);return timer;
    },
    get:user=>{
      const timer=store.getTimer(user.id)||{active:false,taskId:null,last:Date.now(),totals:{}};
      accrue(timer,Date.now());store.saveTimer(user.id,timer);return timer;
    }
  };
}
