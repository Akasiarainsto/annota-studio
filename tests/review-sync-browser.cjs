const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/29346/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT=path.resolve(__dirname,'..');
const BASE_URL=process.env.ANNOTA_BASE_URL||'http://127.0.0.1:8768/';
const REPORT=process.env.ANNOTA_BASE_URL?'pages_review_sync_verification.json':'review_sync_verification.json';
const checks=[],errors=[];
async function check(name,operation){await operation();checks.push(name);process.stdout.write(`PASS ${name}\n`);}
async function task(page,id='DOL-001'){return page.evaluate(id=>JSON.parse(localStorage.getItem('annota_studio_v1')).tasks.find(task=>task.id===id),id);}
async function review(page,name,note='已独立核对素材与标注。',decision='approve'){
 await page.locator('#reviewer').fill(name);await page.locator('#review-note').fill(note);
 if(decision==='approve')for(const control of await page.locator('[data-review-check]').all())await control.check();
 await page.locator(`[data-action="${decision}"]`).click();
}
async function mediaReady(page){await page.waitForFunction(()=>{const player=document.querySelector('#media-player');const image=document.querySelector('#visual-media');return player?.readyState>=2||image?.naturalWidth>0;});}
async function pairState(page){return page.locator('[data-pair-video]').evaluateAll(players=>players.map(player=>({time:player.currentTime,paused:player.paused,rate:player.playbackRate,duration:player.duration})));}
async function waitPair(page,playing){await page.waitForFunction(playing=>[...document.querySelectorAll('[data-pair-video]')].every(player=>player.paused!==playing),playing);}
// This sequential scenario intentionally shares one review history and player lifecycle.
async function run(){
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const context=await browser.newContext({viewport:{width:1500,height:1050},acceptDownloads:true});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(BASE_URL,{waitUntil:'networkidle'});await mediaReady(page);
 await check('first opinion persists while missing evidence and duplicate reviewer cannot approve',async()=>{
  await page.locator('[data-action="submit"]').click();await page.locator('[data-phase="review"]').click();await mediaReady(page);
  await review(page,'','');assert.equal((await task(page)).reviews.length,0);
  await review(page,'Alex');assert.equal((await task(page)).status,'pending');assert.equal((await task(page)).reviews[0].decision,'opinion');assert.match(await page.locator('#review-progress').textContent(),/1 \/ 2/);
  await page.reload({waitUntil:'networkidle'});await page.locator('[data-phase="review"]').click();await mediaReady(page);assert.match(await page.locator('#review-progress').textContent(),/Alex/);
  await review(page,'Ａｌｅｘ');assert.equal((await task(page)).reviews.length,1);assert.equal((await task(page)).status,'pending');
  await page.screenshot({path:path.join(ROOT,'docs/double_review_desktop.png')});
  await review(page,'复核乙');assert.equal((await task(page)).status,'approved');assert.equal((await task(page)).reviews.length,2);
 });
 await check('edit, undo, return and resubmit keep history while starting fresh review rounds',async()=>{
  await page.locator('[data-phase="annotation"]').click();await page.locator('[data-bind="segment.scene"]').fill('会议复核测试');
  await page.locator('h1').click();await page.keyboard.press('Control+z');
  await page.locator('.heading_actions [data-action="save"]').click();assert.equal((await task(page)).status,'draft');assert.equal((await task(page)).reviews.length,2);assert.equal((await task(page)).segments[0].scene,'会议');
  await page.locator('[data-action="submit"]').click();await page.locator('[data-phase="review"]').click();await mediaReady(page);assert.equal((await task(page)).reviewRound,2);assert.match(await page.locator('#review-progress').textContent(),/0 \/ 2/);
  await review(page,'Alex');assert.equal((await task(page)).status,'pending');await review(page,'复核乙','','return');assert.equal((await task(page)).status,'pending');
  await review(page,'复核乙','请重新核对。','return');assert.equal((await task(page)).status,'returned');
  await page.locator('[data-phase="annotation"]').click();await page.locator('[data-action="submit"]').click();assert.equal((await task(page)).reviewRound,3);
  await page.locator('[data-phase="review"]').click();await mediaReady(page);assert.match(await page.locator('#review-progress').textContent(),/0 \/ 2/);
 });
 await check('dispute survives reload, blocks resubmission and completes reasoned arbitration',async()=>{
  await review(page,'复核甲');await review(page,'复核乙','对时间边界判断有分歧。','dispute');assert.equal((await task(page)).status,'disputed');
  await page.reload({waitUntil:'networkidle'});assert(await page.locator('[data-action="submit"]').isDisabled());assert.match(await page.locator('.heading_actions').textContent(),/待仲裁/);
  await page.locator('[data-phase="review"]').click();await mediaReady(page);assert.match(await page.locator('[data-action="approve"]').textContent(),/仲裁/);
  await review(page,'仲裁员','结合原音频边界确认通过。');assert.equal((await task(page)).status,'approved');assert.equal((await task(page)).reviews.at(-1).decision,'arbitrated');
 });
 await check('video and image both require two reviewers and backup preserves complete histories',async()=>{
  for(const [modality,id]of [['image','SDR-001'],['video','SDA-001']]){
   await page.locator(`[data-modality="${modality}"]`).click();await page.locator('[data-phase="annotation"]').click();await mediaReady(page);await page.locator('[data-action="submit"]').click();await page.locator('[data-phase="review"]').click();await mediaReady(page);
   await review(page,'复核甲');assert.equal((await task(page,id)).status,'pending');await review(page,'复核乙');assert.equal((await task(page,id)).status,'approved');
  }
  await page.locator('[data-action="export"]').click();const pending=page.waitForEvent('download');await page.locator('[data-action="export-backup"]').click();const backup=JSON.parse(fs.readFileSync(await(await pending).path(),'utf8'));assert.equal(backup.tasks.find(task=>task.id==='DOL-001').reviews.at(-1).decision,'arbitrated');await page.locator('[data-action="close-modal"]').first().click();
 });
 await check('legacy approvals remain readable without fabricated two-person evidence',async()=>{
  const {SEED_TASKS}=await import(pathToFileURL(path.join(ROOT,'src/seed-data.js')).href);const legacy=structuredClone(SEED_TASKS[0]);legacy.status='approved';legacy.reviews=[{decision:'approved',revision:1,note:'旧版保留意见',at:'2026-10-29'}];
  const legacyContext=await browser.newContext();await legacyContext.addInitScript(value=>localStorage.setItem('annota_studio_v1',JSON.stringify(value)),{schemaVersion:'annota/1',tasks:[legacy]});const legacyPage=await legacyContext.newPage();await legacyPage.goto(BASE_URL,{waitUntil:'networkidle'});await legacyPage.locator('[data-phase="review"]').click();assert.match(await legacyPage.locator('#review-progress').textContent(),/旧版验收/);assert.match(await legacyPage.locator('.review_entry').textContent(),/旧版保留意见/);await legacyContext.close();
 });
 await check('real A/B videos play, pause, seek, restart and change speed together without changing annotation',async()=>{
  const before=await task(page,'SDA-001');await page.locator('[data-phase="evaluation"]').click();await page.waitForFunction(()=>[...document.querySelectorAll('[data-pair-video]')].length===2&&[...document.querySelectorAll('[data-pair-video]')].every(player=>player.readyState>=2));
  await page.locator('[data-pair-action="toggle"]').click();await waitPair(page,true);await page.waitForTimeout(250);let state=await pairState(page);assert(state.every(player=>player.time>0));assert(Math.abs(state[0].time-state[1].time)<.13);
  await page.locator('[data-pair-action="toggle"]').click();await waitPair(page,false);const paused=await pairState(page);await page.waitForTimeout(120);state=await pairState(page);assert(state.every((player,index)=>Math.abs(player.time-paused[index].time)<.04));
  await page.locator('#pair-seek').fill('1.3');await page.locator('#pair-seek').dispatchEvent('input');state=await pairState(page);assert(state.every(player=>Math.abs(player.time-1.3)<.03));
  await page.locator('#pair-speed').selectOption('1.5');assert((await pairState(page)).every(player=>player.rate===1.5));
  await page.locator('[data-pair-action="restart"]').click();await waitPair(page,true);assert((await pairState(page)).every(player=>player.time<.7));await page.locator('[data-pair-action="toggle"]').click();await waitPair(page,false);
  assert.equal((await task(page,'SDA-001')).revision,before.revision);assert.equal((await task(page,'SDA-001')).status,'approved');await page.screenshot({path:path.join(ROOT,'docs/video_sync_desktop.png')});
 });
 await check('drift correction, buffering, shorter duration and leaving the page stop or synchronize both players',async()=>{
  await page.locator('#pair-speed').selectOption('1');await page.locator('[data-pair-action="restart"]').click();await waitPair(page,true);await page.waitForTimeout(550);
  await page.locator('[data-pair-video="B"]').evaluate(player=>{player.currentTime=Math.max(0,player.currentTime-.3);});await page.waitForTimeout(300);let state=await pairState(page);assert(Math.abs(state[0].time-state[1].time)<.13);
  await page.locator('[data-pair-video="B"]').evaluate(player=>player.dispatchEvent(new Event('waiting')));await waitPair(page,false);assert.match(await page.locator('#pair-status').textContent(),/缓冲/);await page.locator('[data-pair-video="B"]').evaluate(player=>player.dispatchEvent(new Event('canplay')));await waitPair(page,true);
  await page.locator('[data-pair-action="toggle"]').click();await waitPair(page,false);
  // The short WAV provides a real 1.5-second media clock inside the second video element.
  await page.locator('[data-pair-video="B"]').evaluate(player=>{player.src=new URL('assets/noise.wav',location.href).href;player.load();});await page.waitForFunction(()=>document.querySelector('[data-pair-video="B"]').readyState>=2);assert(Math.abs(Number(await page.locator('#pair-seek').getAttribute('max'))-1.5)<.01);
  await page.locator('[data-pair-action="restart"]').click();await waitPair(page,true);await waitPair(page,false);state=await pairState(page);assert(state.every(player=>Math.abs(player.time-1.5)<.04));
  await page.locator('[data-pair-action="restart"]').click();await waitPair(page,true);await page.locator('#pair-seek').fill('1.5');await page.locator('#pair-seek').dispatchEvent('input');await waitPair(page,false);assert((await pairState(page)).every(player=>Math.abs(player.time-1.5)<.04));
  await page.locator('[data-pair-action="restart"]').click();await waitPair(page,true);const detached=await page.locator('[data-pair-video]').elementHandles();await page.locator('[data-phase="annotation"]').click();for(const player of detached)assert(await player.evaluate(element=>element.paused&&!element.isConnected));
 });
 await check('pair loading errors disable joint controls and both features fit a 390px viewport',async()=>{
  await page.locator('[data-phase="evaluation"]').click();await page.waitForFunction(()=>[...document.querySelectorAll('[data-pair-video]')].every(player=>player.readyState>=2));
  await page.locator('[data-pair-video="B"]').evaluate(player=>{player.src='data:video/webm,broken';player.load();});await page.waitForFunction(()=>document.querySelector('#pair-status').textContent.includes('加载失败'));assert(await page.locator('[data-pair-action="toggle"]').isDisabled());assert((await pairState(page)).every(player=>player.paused));
  await page.setViewportSize({width:390,height:844});for(const phase of ['review','evaluation']){await page.locator(`[data-phase="${phase}"]`).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await page.screenshot({path:path.join(ROOT,'docs/review_sync_mobile.png')});
 });
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(ROOT,'docs',REPORT),JSON.stringify({url:BASE_URL,checkedAt:new Date().toISOString(),checks,errors},null,2));await browser.close();
}
run().catch(error=>{fs.writeFileSync(path.join(ROOT,'docs',REPORT),JSON.stringify({url:BASE_URL,checks,errors,failure:error.stack},null,2));process.stderr.write(error.stack);process.exit(1);});
