import {randomUUID} from 'node:crypto';
import {readJson,requireCondition,sendJson} from './http.js';
import {acceptMedia} from './media.js';
import {buildDashboard} from './dashboard.js';
import {stratifiedSample} from '../public/src/core/sampling.js';
import {validateVideoEvaluation} from '../public/src/core/video-validation.js';

export function createRoutes(context) {
  const {store,accounts,tasks,timers,uploadRoot}=context;
  // A single routing module keeps HTTP parsing separate from the task/permission services.
  return async (request,response,path)=>{
    if (path==='/api/session'&&request.method==='GET') return sendJson(response,{user:accounts.current(request)});
    if (path==='/api/login'&&request.method==='POST') {
      const session=accounts.login(await readJson(request));return sendJson(response,{user:session.user},200,{'Set-Cookie':session.cookie});
    }
    const user=accounts.requireUser(request);
    if (path==='/api/logout'&&request.method==='POST') {timers.update(user,{action:'stop'});accounts.logout(request);return sendJson(response,{ok:true},200,{'Set-Cookie':'annota_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
    if (path==='/api/tasks'&&request.method==='GET') return sendJson(response,{tasks:tasks.list(user)});
    if (path==='/api/tasks'&&request.method==='POST') {
      requireCondition(user.role==='annotator',403,'请用标注员账号导入任务');
      const body=await readJson(request);const doc=body.document;
      requireCondition(doc&&['audio','video','image'].includes(doc.modality)&&doc.media?.url?.startsWith('/uploads/'),400,'请先导入本地媒体');
      doc.task_id='U-'+randomUUID().slice(0,8);
      const task={id:doc.task_id,label:String(body.label||'导入任务').slice(0,120),modality:doc.modality,objective:'按照项目规范完成标注，检查后提交双人复核。',difficulty:'常规',media:doc.media,draft:doc,reference:null,modelOriginal:null,source:{name:'用户本地导入',url:''},assignee:user.id,status:'draft',version:1,round:0,rounds:[],reviews:[],events:[],updatedAt:new Date().toISOString()};
      store.addTask(task);return sendJson(response,tasks.get(task.id,user),201);
    }
    const match=/^\/api\/tasks\/([^/]+)(?:\/(submit|review|arbitrate|withdraw_review|request_correction|resolve_correction))?$/.exec(path);
    if (match) {
      const [,id,action]=match;
      if (!action&&request.method==='GET') return sendJson(response,tasks.get(id,user));
      const body=await readJson(request);
      if (!action&&request.method==='PUT') return sendJson(response,tasks.save(id,user,body));
      if (action&&request.method==='POST') return sendJson(response,tasks[action](id,user,body));
    }
    if (path==='/api/media'&&request.method==='POST') {requireCondition(user.role==='annotator',403,'只有标注员可以导入媒体');return sendJson(response,await acceptMedia(request,uploadRoot),201);}
    if (path==='/api/timer') return sendJson(response,request.method==='POST'?timers.update(user,await readJson(request)):timers.get(user));
    if (path==='/api/dashboard') {requireCondition(user.role==='manager',403,'项目看板仅负责人可查看');return sendJson(response,buildDashboard(store));}
    if (path==='/api/sample') {
      if (request.method==='GET') return sendJson(response,store.getEvaluation('project','sample')||null);
      requireCondition(user.role==='manager',403,'只有负责人可以建立抽检方案');const options=await readJson(request);
      requireCondition(Number.isFinite(options.rate)&&options.rate>0&&options.rate<=1&&String(options.seed||'').trim(),400,'请填写抽样种子与 0–1 的比例');
      const plan=stratifiedSample(store.listTasks().filter(task=>task.round>0),options);store.saveEvaluation('project','sample',plan);return sendJson(response,plan);
    }
    const evaluation=/^\/api\/evaluations\/(case2|case4)$/.exec(path);
    if (evaluation) {
      if (request.method==='GET') return sendJson(response,store.getEvaluation(user.id,evaluation[1]));
      const doc=await readJson(request);const errors=validateVideoEvaluation(doc);requireCondition(!errors.length,422,'评分格式未通过',errors);
      store.saveEvaluation(user.id,evaluation[1],doc);return sendJson(response,{ok:true});
    }
    throw Object.assign(new Error('接口不存在'),{status:404});
  };
}
