import {openBrowserDatabase} from './browser-database.js';
const SEED_URL=new URL('../../assets/demo_tasks.json',import.meta.url);
async function loadSeed() {
  const response=await fetch(SEED_URL);if(!response.ok)throw new Error('教学任务载入失败，请检查网络后重试');
  const tasks=await response.json();return {tasks:Object.fromEntries(tasks.map(task=>[task.id,task])),timers:{},evaluations:{}};
}
async function initializeWorkspace(database) {
  const exists=await new Promise((resolve,reject)=>{const request=database.transaction('workspace').objectStore('workspace').get('current');request.onsuccess=()=>resolve(Boolean(request.result));request.onerror=()=>reject(request.error);});
  if(exists)return;
  const seed=await loadSeed();
  await new Promise((resolve,reject)=>{
    const transaction=database.transaction('workspace','readwrite'),table=transaction.objectStore('workspace'),request=table.get('current');
    request.onsuccess=()=>{if(!request.result)table.put(seed,'current');};transaction.oncomplete=resolve;transaction.onabort=()=>reject(new Error('初始演示任务保存失败'));
  });
}
// A single IndexedDB write transaction serializes reads and writes across tabs without lost revisions.
export async function transactDemoWorkspace(operation) {
  const database=await openBrowserDatabase();
  try{await initializeWorkspace(database);return await new Promise((resolve,reject)=>{
    const transaction=database.transaction('workspace','readwrite');const table=transaction.objectStore('workspace');let result,failure;
    const request=table.get('current');
    request.onsuccess=()=>{try{const workspace=request.result;result=operation(workspace);table.put(workspace,'current');}catch(error){failure=error;transaction.abort();}};
    transaction.oncomplete=()=>resolve(result);
    transaction.onabort=()=>reject(failure||new Error('保存失败，浏览器存储空间可能不足；当前页面草稿仍保留'));
  });}finally{database.close();}
}
export async function resetDemoWorkspace() {
  const seed=await loadSeed();const database=await openBrowserDatabase();
  try{await new Promise((resolve,reject)=>{const transaction=database.transaction(['workspace','media'],'readwrite');transaction.objectStore('workspace').put(seed,'current');transaction.objectStore('media').clear();transaction.oncomplete=resolve;transaction.onabort=()=>reject(new Error('演示数据重置失败'));});}
  finally{database.close();}
  for(const key of Object.keys(localStorage))if(key.startsWith('annota-interview-draft:'))localStorage.removeItem(key);
  sessionStorage.removeItem('annota-interview-user');
}
