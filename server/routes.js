import {readJson,requireCondition} from './http.js';
import {listProjects,createProject,listMembers,createInvite,joinProject,changeRole,getDashboard} from './project-service.js';
import {listTasks,readTask,createTask,saveTask,assignTask,submitTask,recordSession} from './task-service.js';
import {listBatches,readBatch,createBatch,voteSample,arbitrateSample} from './quality-service.js';
import {uploadMedia,readMedia} from './media-service.js';

/** One dispatch table, with authentication and membership checks in each service. */
export async function routeRequest(request,user) {
  const url=new URL(request.url),[resource,id,action,memberId]=url.pathname.split('/').filter(Boolean);
  const method=request.method;
  if(resource==='me'&&method==='GET')return user;
  if(resource==='projects'&&!id&&method==='GET')return listProjects(user.id);
  if(resource==='projects'&&!id&&method==='POST')return createProject(user.id,(await readJson(request)).title);
  if(resource==='join'&&method==='POST')return joinProject(user.id,(await readJson(request)).code);
  if(resource==='projects'&&action==='members'&&method==='GET')return listMembers(user.id,id);
  if(resource==='projects'&&action==='members'&&memberId&&method==='PATCH')return changeRole(user.id,{...await readJson(request),projectId:id,memberId});
  if(resource==='projects'&&action==='invites'&&method==='POST')return createInvite(user.id,{...await readJson(request),projectId:id});
  if(resource==='projects'&&action==='dashboard'&&method==='GET')return getDashboard(user.id,{projectId:id,modality:url.searchParams.get('modality')||'all'});
  if(resource==='projects'&&action==='tasks'&&method==='GET')return listTasks(user.id,id);
  if(resource==='projects'&&action==='tasks'&&method==='POST')return createTask(user.id,{...await readJson(request),projectId:id});
  if(resource==='projects'&&action==='media'&&method==='POST')return uploadMedia(user.id,{projectId:id,name:url.searchParams.get('name'),request});
  if(resource==='projects'&&action==='batches'&&method==='GET')return listBatches(user.id,id);
  if(resource==='projects'&&action==='batches'&&method==='POST')return createBatch(user.id,{...await readJson(request),projectId:id});
  if(resource==='tasks'&&!action&&method==='GET')return readTask(user.id,id);
  if(resource==='tasks'&&!action&&method==='PUT')return saveTask(user.id,{...await readJson(request),id});
  if(resource==='tasks'&&action==='assignment'&&method==='PATCH')return assignTask(user.id,{...await readJson(request),id});
  if(resource==='tasks'&&action==='submit'&&method==='POST')return submitTask(user.id,{...await readJson(request),id});
  if(resource==='tasks'&&action==='session'&&method==='POST')return recordSession(user.id,{...await readJson(request),taskId:id});
  if(resource==='batches'&&method==='GET')return readBatch(user.id,id);
  if(resource==='samples'&&action==='vote'&&method==='POST')return voteSample(user.id,{...await readJson(request),id});
  if(resource==='samples'&&action==='arbitrate'&&method==='POST')return arbitrateSample(user.id,{...await readJson(request),id});
  if(resource==='media'&&method==='GET')return readMedia(user.id,{id,range:request.headers.get('range')});
  requireCondition(false,404,'接口不存在');
}
