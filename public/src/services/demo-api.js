import {transactDemoWorkspace} from './demo-workspace.js';
import {createDemoStore,DEMO_USERS} from './demo-store.js';
import {routeDemoRequest} from './demo-routes.js';
import {writeBrowserMedia} from './browser-database.js';
import {requireCondition} from '../core/require-condition.js';
const SESSION_KEY='annota-interview-user';
function currentUser(){return DEMO_USERS.find(user=>user.id===sessionStorage.getItem(SESSION_KEY))||null;}
async function storeMedia(file) {
  requireCondition(currentUser()?.role==='annotator',403,'只有标注员角色可以导入素材');
  requireCondition(file instanceof Blob&&file.size<=100*1024*1024,413,'演示版单个素材上限为 100 MB');
  const id=crypto.randomUUID();await writeBrowserMedia(id,file);return {url:new URL('../../uploads/'+id,import.meta.url).pathname};
}
export async function requestDemo(path,options={}) {
  const method=options.method||'GET',body=typeof options.body==='string'?JSON.parse(options.body):options.body||{};
  if(path==='/session')return {user:currentUser()};
  if(path==='/login'){
    const user=DEMO_USERS.find(candidate=>candidate.id===body.username);requireCondition(user&&body.password==='demo1234',401,'演示角色或演示密码不正确');
    sessionStorage.setItem(SESSION_KEY,user.id);return {user};
  }
  if(path==='/media')return await storeMedia(body);
  const user=currentUser();const result=await transactDemoWorkspace(workspace=>routeDemoRequest({store:createDemoStore(workspace),user,path,method,body}));
  if(path==='/logout')sessionStorage.removeItem(SESSION_KEY);return result;
}
export async function initializeDemoMedia() {
  if(!('serviceWorker' in navigator))throw new Error('请使用支持 Service Worker 的 Edge 或 Chrome 打开演示');
  await navigator.serviceWorker.register(new URL('../../media-worker.js',import.meta.url),{type:'module',scope:new URL('../../',import.meta.url).pathname});
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
}
