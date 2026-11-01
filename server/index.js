import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {readFileSync,mkdirSync} from 'node:fs';
import {createStore} from './sqlite-store.js';
import {createAccounts,seedAccounts} from './accounts.js';
import {seedTasks} from './seed.js';
import {createTaskService} from './task-service.js';
import {createTimerService} from './timer-service.js';
import {createRoutes} from './routes.js';
import {serveFile} from './media.js';
import {sendJson,requireCondition} from './http.js';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function startServer(options={}) {
  const dataRoot=options.dataRoot||process.env.ANNOTA_DATA_DIR||join(ROOT,'.local_data');
  const uploadRoot=join(dataRoot,'uploads');mkdirSync(uploadRoot,{recursive:true});
  const store=createStore(join(dataRoot,'workbench.sqlite'));seedAccounts(store);seedTasks(store,ROOT);
  const accounts=createAccounts(store);const tasks=createTaskService(store);const timers=createTimerService(store);
  const routes=createRoutes({store,accounts,tasks,timers,uploadRoot});
  const server=createServer(async(request,response)=>{
    try {
      const host=request.headers.host||'';requireCondition(/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host),403,'仅支持本机访问');
      if (request.headers.origin) requireCondition(['http://'+host].includes(request.headers.origin),403,'请求来源不匹配');
      const path=decodeURIComponent(new URL(request.url,'http://'+host).pathname);
      if (path==='/src/runtime-config.js') {response.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return response.end(readFileSync(join(ROOT,'public/src/runtime-config.js'),'utf8').replace("RUNTIME_MODE='interview'","RUNTIME_MODE='local'"));}
      if (path==='/health') return sendJson(response,{ok:true,version:'3.0.0-local.3',workspace:ROOT});
      if (path.startsWith('/api/')) return await routes(request,response,path);
      if (path.startsWith('/uploads/')) {accounts.requireUser(request);return await serveFile(request,response,{root:uploadRoot,path:path.slice(8)});}
      return await serveFile(request,response,{root:join(ROOT,'public'),path:path==='/'?'/index.html':path});
    } catch(error) {
      if (!response.headersSent) sendJson(response,{error:error.status?error.message:'本地服务出现错误，请查看服务日志',issues:error.issues||[]},error.status||500);
      if (!error.status) process.stderr.write((error.stack||String(error))+'\n');
    }
  });
  server.on('close',()=>store.close());server.listen(options.port??Number(process.env.PORT||8788),'127.0.0.1');
  return server;
}
if (process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const server=startServer();server.on('listening',()=>process.stdout.write(`Annota local ready: http://127.0.0.1:${server.address().port}/\n`));
}
