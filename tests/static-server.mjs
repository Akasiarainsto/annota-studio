import {createServer} from 'node:http';
import {resolve,join} from 'node:path';
import {serveFile} from '../server/media.js';
export function startStaticServer(root=resolve('dist')) {
  return createServer(async(request,response)=>{
    try{const url=new URL(request.url,'http://localhost');const prefix='/annota-studio/';
      if(url.pathname==='/annota-studio'){response.writeHead(302,{Location:prefix});response.end();return;}
      if(!url.pathname.startsWith(prefix)){response.writeHead(404);response.end();return;}
      const path=decodeURIComponent(url.pathname.slice(prefix.length));
      await serveFile(request,response,{root,path:'/'+(path||'index.html')});
    }catch(error){response.writeHead(error.status||500);response.end(error.message);}
  }).listen(0,'127.0.0.1');
}
