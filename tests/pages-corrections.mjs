import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import {startStaticServer} from './static-server.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/29346/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const DATA_ROOT=await mkdtemp(join(tmpdir(),'annota-correction-test-'));
const EVIDENCE=resolve('evidence');await mkdir(EVIDENCE,{recursive:true});
const server=startStaticServer();await once(server,'listening');const BASE=process.env.ANNOTA_BASE_URL||('http://127.0.0.1:'+server.address().port+'/annota-studio');
const browser=await chromium.launch({headless:true,...(process.env.ANNOTA_BASE_URL?{proxy:{server:process.env.ANNOTA_PROXY||'http://127.0.0.1:10808'}}:{}),executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const sharedContext=await browser.newContext({viewport:{width:1366,height:900}});const errors=[],steps=[];
async function login(username){const page=await sharedContext.newPage();page.on('pageerror',error=>errors.push(error.stack));await page.goto(BASE);await page.locator('[name=username]').selectOption(username);await page.getByRole('button',{name:'登录工作区'}).click();await page.locator('#main').waitFor();return page;}
async function api(page,path,method='GET',body){return await page.evaluate(async ({path,method,body})=>{const {request}=await import('./src/services/api.js');return await request(path,{method,body:body?JSON.stringify(body):undefined});},{path,method,body});}
async function prepare(page,id){let task=await api(page,'/tasks/'+id);task.draft.segments.forEach(segment=>segment.boundary_status='confirmed');task=await api(page,'/tasks/'+id,'PUT',{version:task.version,document:task.draft});return await api(page,`/tasks/${id}/submit`,'POST',{version:task.version});}
async function open(page,id){await page.goto(BASE+'/?task='+id+'&mode=quality');await page.locator('#export-task').waitFor();}
async function review(page,id,decision){await open(page,id);await page.locator('#open-review').click();for(const checkbox of await page.locator('#review-form [name=checks]').all())await checkbox.check();await page.locator(`[name=decision][value=${decision}]`).check();await page.locator('[name=note]').fill(decision==='fail'?'需重新核对片段内容与术语':'');await page.locator('#review-form button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#dialog').open&&!document.querySelector('#open-review'));}
let passed=false;
try{
  const annotator=await login('annotator'),first=await login('reviewer_a'),second=await login('reviewer_b'),manager=await login('manager');
  await prepare(annotator,'A-001');await review(first,'A-001','pass');await first.locator('#withdraw-review').waitFor();await first.screenshot({path:join(EVIDENCE,'review_withdrawal.png')});
  await first.locator('#withdraw-review').click();await first.locator('#correction-form [name=reason]').fill('刚才误点通过，应核对后改为不合格');await first.locator('#correction-form button[type=submit]').click();await first.locator('#open-review').waitFor();
  let task=await api(first,'/tasks/A-001');assert.equal(task.reviewCount,0);assert.equal(task.reviews[0].decision,'pass');assert.ok(task.reviews[0].withdrawnAt);assert.equal((await api(second,'/tasks/A-001')).reviews.length,0);
  await first.locator('#task-history').click();assert.ok((await first.locator('#dialog').innerText()).includes('已撤回'));assert.ok((await first.locator('#dialog').innerText()).includes('刚才误点通过'));await first.locator('[data-close-dialog]').click();
  await review(first,'A-001','fail');await review(second,'A-001','fail');assert.equal((await api(first,'/tasks/A-001')).status,'returned');steps.push('single-review withdrawal, audit, re-entry and changed outcome');
  await prepare(annotator,'V-001');await review(first,'V-001','pass');await review(second,'V-001','pass');const original=(await api(first,'/tasks/V-001')).rounds[0].document;
  await open(first,'V-001');await first.locator('#request-review-correction').waitFor();await first.screenshot({path:join(EVIDENCE,'review_correction_request.png')});await first.locator('#request-review-correction').click();await first.locator('#correction-form [name=reason]').fill('刚才通过结论有误，工具动作未核实');await first.locator('#correction-form button[type=submit]').click();await first.waitForFunction(()=>document.querySelector('.task-title .badge')?.textContent==='复核更正待处理');
  await manager.locator('[data-nav=quality]').click();await manager.locator('[data-open-task="V-001"]').first().waitFor();assert.ok((await manager.locator('[data-task-row="V-001"]').innerText()).includes('处理更正'));
  await open(manager,'V-001');await manager.locator('#handle-review-correction').click();await manager.locator('#correction-form [name=decision]').selectOption('reopen');await manager.locator('#correction-form [name=reason]').fill('同意更正，按同一冻结版本重新进行双人复核');await manager.screenshot({path:join(EVIDENCE,'review_correction_manager.png')});await manager.locator('#correction-form button[type=submit]').click();await manager.waitForFunction(()=>!document.querySelector('#dialog').open&&document.querySelector('.task-title .badge')?.textContent==='待双人复核');
  task=await api(first,'/tasks/V-001');assert.equal(task.round,2);assert.equal(task.reviewCount,0);assert.deepEqual(task.rounds[0].document,original);assert.deepEqual(task.rounds[1].document,original);assert.equal(task.correctionRequests[0].status,'reopened');
  await review(first,'V-001','fail');await review(second,'V-001','fail');task=await api(first,'/tasks/V-001');assert.equal(task.status,'returned');assert.equal(task.reviews.length,4);
  const dashboard=await api(manager,'/dashboard');assert.equal(dashboard.kappa.matrix.pass_pass,0);assert.equal(dashboard.kappa.matrix.fail_fail,2);steps.push('completed-result request, manager reopening, new independent votes and valid statistics');
  assert.deepEqual(errors,[]);passed=true;process.stdout.write('PASS '+steps.join('\nPASS ')+'\n');
}catch(error){process.stderr.write(error.stack+'\n');process.exitCode=1;}
finally{await writeFile(join(EVIDENCE,'pages_corrections_report.json'),JSON.stringify({base:BASE,passed,steps,consoleErrors:errors},null,2));await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));assert.ok(DATA_ROOT.startsWith(join(tmpdir(),'annota-correction-test-')));await rm(DATA_ROOT,{recursive:true,force:true});}
