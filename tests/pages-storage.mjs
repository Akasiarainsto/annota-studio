import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import {startStaticServer} from './static-server.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/29346/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=startStaticServer();await once(server,'listening');const BASE=process.env.ANNOTA_BASE_URL||('http://127.0.0.1:'+server.address().port+'/annota-studio/');
const browser=await chromium.launch({headless:true,...(process.env.ANNOTA_BASE_URL?{proxy:{server:process.env.ANNOTA_PROXY||'http://127.0.0.1:10808'}}:{}),executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const errors=[],steps=[];let passed=false;
async function login(context){const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(BASE);await page.getByRole('button',{name:'登录工作区'}).click();await page.locator('#main').waitFor();await page.waitForFunction(()=>!document.querySelector('#app').inert);return page;}
async function api(page,path,options){return await page.evaluate(async({path,options})=>{const {request}=await import('./src/services/api.js');return await request(path,options);},{path,options});}
try{
  const first=await login(await browser.newContext()),second=await login(await browser.newContext());
  const task=await api(first,'/tasks/V-002');task.draft.segments[0].caption='第一位访问者的独立试标';
  await api(first,'/tasks/V-002',{method:'PUT',body:JSON.stringify({version:task.version,document:task.draft})});
  assert.equal((await api(first,'/tasks/V-002')).version,2);assert.equal((await api(second,'/tasks/V-002')).version,1);
  await first.reload();await first.locator('#main').waitFor();assert.equal((await api(first,'/tasks/V-002')).draft.segments[0].caption,'第一位访问者的独立试标');
  await first.route('**/assets/demo_tasks.json',route=>route.abort());assert.equal((await api(first,'/tasks/V-002')).version,2);await first.unroute('**/assets/demo_tasks.json');steps.push('different visitors keep isolated databases; saved edits survive reload without re-fetching seed');
  await first.locator('#account-button').click();await first.locator('#reset-demo').waitFor();first.once('dialog',dialog=>dialog.dismiss());await first.locator('#reset-demo').click();
  await first.getByRole('button',{name:'登录工作区'}).click();await first.locator('#main').waitFor();assert.equal((await api(first,'/tasks/V-002')).version,2);
  await first.locator('#account-button').click();await first.locator('#reset-demo').waitFor();first.once('dialog',dialog=>dialog.accept());await first.locator('#reset-demo').click();
  await first.waitForFunction(()=>document.querySelector('#login-error').textContent.includes('已重置'));await first.getByRole('button',{name:'登录工作区'}).click();await first.locator('#main').waitFor();
  const tasks=(await api(first,'/tasks')).tasks;assert.equal(tasks.length,4);assert.ok(tasks.every(task=>task.version===1&&task.status==='draft'));
  assert.equal((await api(second,'/tasks/V-002')).version,1);steps.push('reset needs confirmation and restores only this browser to four clean seed tasks');
  await first.locator('[data-nav=guide]').click();assert.ok((await first.locator('.guide-content').innerText()).includes('不是真实账号认证'));assert.ok((await first.locator('.demo-mode-label').innerText()).includes('演示 · 本浏览器'));
  assert.deepEqual(errors,[]);passed=true;process.stdout.write(steps.map(step=>'PASS '+step).join('\n')+'\n');
}finally{await mkdir('evidence',{recursive:true});await writeFile('evidence/pages_storage_report.json',JSON.stringify({base:BASE,passed,steps,consoleErrors:errors},null,2));await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
