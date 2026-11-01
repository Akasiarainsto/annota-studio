import {createTaskService} from '../domain/task-service.js';
import {createTimerService} from '../domain/timer-service.js';
import {buildDashboard} from '../domain/dashboard.js';
import {requireCondition} from '../core/require-condition.js';
import {stratifiedSample} from '../core/sampling.js';
import {validateVideoEvaluation} from '../core/video-validation.js';

function createImportedTask(body,user) {
  const doc=body.document;const base=new URL('../../',import.meta.url).pathname;
  requireCondition(user.role==='annotator',403,'请用标注员角色导入任务');
  requireCondition(doc&&['audio','video','image'].includes(doc.modality)&&doc.media?.url?.startsWith(base+'uploads/'),400,'请先导入媒体文件');
  doc.task_id='U-'+crypto.randomUUID().slice(0,8);
  return {id:doc.task_id,label:String(body.label||'导入任务').slice(0,120),modality:doc.modality,objective:'按照项目规范完成标注，检查后提交双人复核。',difficulty:'常规',media:doc.media,draft:doc,reference:null,modelOriginal:null,source:{name:'浏览器导入素材',url:''},assignee:user.id,status:'draft',version:1,round:0,rounds:[],reviews:[],events:[],updatedAt:new Date().toISOString()};
}
export function routeDemoRequest(options) {
  const {store,user,path,method,body}=options;const tasks=createTaskService(store),timers=createTimerService(store);
  requireCondition(user,401,'请先选择演示角色');
  if(path==='/logout'){timers.update(user,{action:'stop'});return {ok:true};}
  if(path==='/tasks'&&method==='GET')return {tasks:tasks.list(user)};
  if(path==='/tasks'&&method==='POST'){const task=createImportedTask(body,user);store.addTask(task);return tasks.get(task.id,user);}
  const match=/^\/tasks\/([^/]+)(?:\/(submit|review|arbitrate|withdraw_review|request_correction|resolve_correction))?$/.exec(path);
  if(match){const [,id,action]=match;if(!action&&method==='GET')return tasks.get(id,user);if(!action&&method==='PUT')return tasks.save(id,user,body);if(action&&method==='POST')return tasks[action](id,user,body);}
  if(path==='/timer')return method==='POST'?timers.update(user,body):timers.get(user);
  if(path==='/dashboard'){requireCondition(user.role==='manager',403,'项目看板仅负责人角色可查看');return buildDashboard(store);}
  if(path==='/sample'){
    if(method==='GET')return store.getEvaluation('project','sample');requireCondition(user.role==='manager',403,'只有负责人角色可以建立抽检方案');
    requireCondition(Number.isFinite(body.rate)&&body.rate>0&&body.rate<=1&&String(body.seed||'').trim(),400,'请填写抽样种子与 0–1 的比例');
    const plan=stratifiedSample(store.listTasks().filter(task=>task.round>0),body);store.saveEvaluation('project','sample',plan);return plan;
  }
  const evaluation=/^\/evaluations\/(case2|case4)$/.exec(path);
  if(evaluation){if(method==='GET')return store.getEvaluation(user.id,evaluation[1]);const errors=validateVideoEvaluation(body);requireCondition(!errors.length,422,'评分格式未通过',errors);store.saveEvaluation(user.id,evaluation[1],body);return {ok:true};}
  throw Object.assign(new Error('演示接口不存在'),{status:404});
}
