import {requireCondition} from '../public/src/core/require-condition.js';
export {requireCondition};
export function sendJson(response,body,status=200,headers={}) {
  response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});
  response.end(JSON.stringify(body));
}
export async function readBytes(request,limit=2*1024*1024) {
  const chunks=[];let size=0;
  for await (const chunk of request) {
    size+=chunk.length;requireCondition(size<=limit,413,'文件超过本地演示限制');chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export async function readJson(request) {
  const content=await readBytes(request);
  try {return JSON.parse(content.toString('utf8'));}
  catch {throw Object.assign(new Error('请求不是合法 JSON'),{status:400});}
}
export const getCookie = request => (request.headers.cookie||'').split(';').map(item=>item.trim()).find(item=>item.startsWith('annota_session='))?.slice(15)||'';
