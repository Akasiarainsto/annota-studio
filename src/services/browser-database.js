export const DATABASE_NAME='annota-interview-v1';
export function openBrowserDatabase() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE_NAME,1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('workspace');request.result.createObjectStore('media');};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error('浏览器存储无法打开，请检查浏览器是否允许此站点保存数据'));
    request.onblocked=()=>reject(new Error('浏览器数据库升级被其他页面阻挡，请关闭旧演示标签页后重试'));
  });
}
export async function writeBrowserMedia(id,file) {
  const database=await openBrowserDatabase();
  try{await new Promise((resolve,reject)=>{const transaction=database.transaction('media','readwrite');transaction.objectStore('media').put(file,id);transaction.oncomplete=resolve;transaction.onabort=()=>reject(new Error('素材保存失败，浏览器存储空间可能不足'));});}
  finally{database.close();}
}
export async function readBrowserMedia(id) {
  const database=await openBrowserDatabase();
  try{return await new Promise((resolve,reject)=>{const request=database.transaction('media').objectStore('media').get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  finally{database.close();}
}
