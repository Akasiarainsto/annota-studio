import {RUNTIME_MODE} from '../runtime-config.js';
import {requestDemo} from './demo-api.js';
export async function request(path, options={}) {
  if(RUNTIME_MODE==='interview')return await requestDemo(path,options);
  const response=await fetch('/api'+path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers}});
  const result=await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error||'请求失败'),{status:response.status,issues:result.issues||[]});
  return result;
}
export const post = (path,body) => request(path,{method:'POST',body:JSON.stringify(body)});
export function downloadFile(name,content,type='application/json;charset=utf-8') {
  const blob=content instanceof Blob?content:new Blob([content],{type});const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function uploadFile(file) {
  return request('/media',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name)},body:file});
}
