import {createReadStream} from 'node:fs';
import {stat,writeFile} from 'node:fs/promises';
import {resolve,extname,relative} from 'node:path';
import {randomUUID} from 'node:crypto';
import {readBytes,requireCondition} from './http.js';

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.wav':'audio/wav','.mp3':'audio/mpeg','.m4a':'audio/mp4','.mp4':'video/mp4','.webm':'video/webm','.svg':'image/svg+xml'};
export async function serveFile(request,response,options) {
  const {root,path}=options;const absolute=resolve(root,'.'+path);
  requireCondition(!relative(root,absolute).startsWith('..'),403,'路径不允许');
  let details;
  try {details=await stat(absolute);} catch {throw Object.assign(new Error('文件不存在'),{status:404});}
  requireCondition(details.isFile(),404,'文件不存在');
  const headers={'Content-Type':MIME[extname(absolute)]||'application/octet-stream','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
  if (request.headers.range) {
    const match=/^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
    requireCondition(match,416,'不支持该 Range');
    const start=match[1]?Number(match[1]):Math.max(0,details.size-Number(match[2]));
    const end=match[1]&&match[2]?Math.min(Number(match[2]),details.size-1):details.size-1;
    if (start>end||start>=details.size) {response.writeHead(416,{'Content-Range':`bytes */${details.size}`});response.end();return;}
    response.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${details.size}`,'Content-Length':end-start+1});
    createReadStream(absolute,{start,end}).pipe(response);return;
  }
  response.writeHead(200,{...headers,'Content-Length':details.size,'Cache-Control':'no-cache'});
  if (request.method==='HEAD') return response.end();
  createReadStream(absolute).pipe(response);
}
export async function acceptMedia(request,uploadRoot) {
  const ext=extname(decodeURIComponent(request.headers['x-file-name']||'')).toLowerCase();
  requireCondition(['.wav','.mp3','.m4a','.mp4','.webm','.jpg','.jpeg','.png'].includes(ext),400,'支持 WAV/MP3/M4A、MP4/WebM、JPG/PNG');
  const bytes=await readBytes(request,100*1024*1024);requireCondition(bytes.length,400,'文件为空');
  const filename=randomUUID()+ext;await writeFile(resolve(uploadRoot,filename),bytes);
  return {url:'/uploads/'+filename};
}
