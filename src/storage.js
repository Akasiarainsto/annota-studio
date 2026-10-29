import {getCloudContext} from './cloud-context.js';

const STORE_KEY='annota_studio_v1';
const DB_NAME='annota_media_v1';
export function loadTasks(seedTasks) {
  const cloud=getCloudContext();if(cloud)return {tasks:cloud.tasks,blocked:false};
  try {
    const serialized=localStorage.getItem(STORE_KEY);
    if (!serialized) return {tasks:structuredClone(seedTasks),blocked:false};
    const parsed=JSON.parse(serialized);
    return {tasks:parsed.tasks,backup:parsed,blocked:false};
  } catch (error) {
    return {tasks:structuredClone(seedTasks),blocked:true,error:`本地草稿无法读取：${error.message}`};
  }
}
export function persistTasks(tasks) {
  const cloud=getCloudContext();if(cloud)return cloud.saveTasks(tasks);
  const snapshot=structuredClone(tasks);
  for (const task of snapshot) if (task.media.imported) task.media.url='';
  localStorage.setItem(STORE_KEY,JSON.stringify({schemaVersion:'annota/1',tasks:snapshot}));
}
function openMediaDatabase() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('media');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
export async function storeMedia(key,file) {
  const database=await openMediaDatabase();
  return new Promise((resolve,reject)=>{
    const transaction=database.transaction('media','readwrite');
    transaction.objectStore('media').put(file,key);
    transaction.oncomplete=()=>{database.close();resolve();};
    transaction.onerror=()=>{database.close();reject(transaction.error);};
    transaction.onabort=()=>{database.close();reject(transaction.error || new Error('媒体保存被中止'));};
  });
}
export async function readMedia(key) {
  const database=await openMediaDatabase();
  return new Promise((resolve,reject)=>{
    const request=database.transaction('media','readonly').objectStore('media').get(key);
    request.onsuccess=()=>{database.close();resolve(request.result || null);};
    request.onerror=()=>{database.close();reject(request.error);};
  });
}
