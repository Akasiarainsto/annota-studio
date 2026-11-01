import {mkdir,cp,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {seedTasks} from '../server/seed.js';
const ROOT=resolve(import.meta.dirname,'..'),DIST=join(ROOT,'dist');
const tasks=[];seedTasks({addTask:task=>tasks.push(task)},ROOT);
function makeRelative(value) {
  if(typeof value==='string'&&value.startsWith('/assets/'))return '.'+value;
  if(Array.isArray(value))return value.map(makeRelative);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,makeRelative(item)]));
  return value;
}
await mkdir(DIST,{recursive:true});await cp(join(ROOT,'public'),DIST,{recursive:true});
await writeFile(join(DIST,'assets/demo_tasks.json'),JSON.stringify(makeRelative(tasks),null,2)+'\n');
await writeFile(join(DIST,'.nojekyll'),'');
async function verifyScripts(directory) {
  for(const file of await readdir(directory,{withFileTypes:true})){
    const path=join(directory,file.name);if(file.isDirectory())await verifyScripts(path);
    else if(file.name.endsWith('.js')){const script=await readFile(path,'utf8');if(/from\s+['"]node:/.test(script))throw new Error('Node-only import in public browser script: '+path);}
  }
}
await verifyScripts(DIST);process.stdout.write('Built static interview demo in '+DIST+'\n');
