import {readBrowserMedia} from './src/services/browser-database.js';
async function serveImportedMedia(request,id) {
  const file=await readBrowserMedia(id);if(!file)return new Response('导入素材不在此浏览器中',{status:404});
  const headers={'Content-Type':file.type||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-store'};
  if(request.method==='HEAD')return new Response(null,{headers:{...headers,'Content-Length':String(file.size)}});
  const range=request.headers.get('Range');
  if(!range)return new Response(file,{headers:{...headers,'Content-Length':String(file.size)}});
  const match=/^bytes=(\d*)-(\d*)$/.exec(range);let start=0,end=file.size-1;
  if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${file.size}`}});
  if(!match[1])start=Math.max(0,file.size-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
  if(start>end||start>=file.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${file.size}`}});
  return new Response(file.slice(start,end+1),{status:206,headers:{...headers,'Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${file.size}`}});
}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url),prefix=new URL('./uploads/',self.registration.scope).pathname;
  if(url.origin===self.location.origin&&url.pathname.startsWith(prefix))event.respondWith(serveImportedMedia(event.request,url.pathname.slice(prefix.length)));
});
