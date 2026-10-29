const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/29346/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT=path.resolve(__dirname,'..');
const checks=[];
const errors=[];
async function check(name,operation){await operation();checks.push(name);process.stdout.write(`PASS ${name}\n`);}
async function getTasks(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('annota_studio_v1')).tasks);}
async function savedTask(page,id){return (await getTasks(page)).find(task=>task.id===id);}
async function save(page){await page.locator('.heading_actions [data-action="save"]').click();}
async function drag(page,selector,from,to){const box=await page.locator(selector).boundingBox();await page.mouse.move(box.x+box.width*from[0],box.y+box.height*from[1]);await page.mouse.down();await page.mouse.move(box.x+box.width*to[0],box.y+box.height*to[1],{steps:12});await page.mouse.up();}
async function captureDownload(page,action){const promise=page.waitForEvent('download');await action();const download=await promise;return JSON.parse(fs.readFileSync(await download.path(),'utf8'));}

async function run(){
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:8768/',{waitUntil:'networkidle'});
 await check('audio loads actual WAV, plays and changes playback speed',async()=>{
  await page.waitForFunction(()=>document.querySelector('audio')?.readyState>=2);
  assert(Math.abs(await page.locator('audio').evaluate(audio=>audio.duration)-4.898503)<.01);
  await page.locator('[data-action="play"]').click();await page.waitForTimeout(250);assert(await page.locator('audio').evaluate(audio=>audio.currentTime>0&&!audio.paused));
  await page.locator('#playback-speed').selectOption('1.5');assert.equal(await page.locator('audio').evaluate(audio=>audio.playbackRate),1.5);
  await page.locator('[data-action="play"]').click();
 });
 await check('audio edit persists after reload and independent CER remains 14.3%',async()=>{
  await page.locator('[data-bind="segment.text"]').fill('今天下午三点，已人工核对');await save(page);await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('[data-bind="segment.text"]').inputValue(),'今天下午三点，已人工核对');
  await page.locator('[data-phase="evaluation"]').click();await page.waitForSelector('.cer_value');assert.match(await page.locator('.cer_value').textContent(),/14\.3/);
  await page.locator('[data-phase="annotation"]').click();await page.locator('[data-bind="segment.text"]').fill('今天下午三点，');
 });
 await check('time overflow is blocked and issues locate the field',async()=>{
  await page.locator('[data-bind="segment.end"]').fill('99');await page.locator('[data-action="submit"]').click();
  await page.locator('dialog[open]').waitFor();assert.match(await page.locator('#modal-body').textContent(),/超过声明的媒体时长/);
  await page.locator('#modal-body [data-issue]').first().click();await page.locator('[data-bind="segment.end"]').fill('2.35');
 });
 await check('submit, reason-required return, revise, approve, and edit invalidates approval',async()=>{
  await page.locator('[data-action="submit"]').click();await page.locator('[data-phase="review"]').click();await page.waitForSelector('#review-note');
  await page.locator('[data-action="return"]').click();assert.equal((await savedTask(page,'DOL-001')).status,'pending');
  await page.locator('#review-note').fill('请核对第一句时间边界。');await page.locator('[data-action="return"]').click();assert.equal((await savedTask(page,'DOL-001')).status,'returned');
  await page.locator('[data-phase="annotation"]').click();await page.locator('[data-bind="segment.text"]').fill('今天下午三点，');
  await page.locator('[data-action="submit"]').click();await page.locator('[data-phase="review"]').click();
  for(const checkbox of await page.locator('[data-review-check]').all())await checkbox.check();
  await page.locator('[data-action="approve"]').click();assert.equal((await savedTask(page,'DOL-001')).status,'approved');
  await page.locator('[data-phase="annotation"]').click();await page.locator('[data-bind="segment.scene"]').fill('会议通知');await save(page);
  const task=await savedTask(page,'DOL-001');assert.equal(task.status,'draft');assert.equal(task.reviews.length,2);assert(task.revision>1);
 });
 await check('blank audio practice uses drag-created real time segment',async()=>{
  await page.locator('[data-action="blank"]').click();await page.waitForSelector('.empty_state');await drag(page,'#timeline-canvas',[.1,.5],[.5,.5]);
  await page.locator('[data-bind="segment.text"]').fill('模拟人工听写');await save(page);
  const practice=(await getTasks(page)).find(task=>task.title.startsWith('空白练习'));assert.equal(practice.segments.length,1);assert(practice.segments[0].start>0&&practice.segments[0].end<practice.media.duration);
 });
 await check('image box draw, move, undo, caption and labels are editable',async()=>{
  await page.locator('[data-modality="image"]').click();await page.waitForSelector('#visual-media');await page.locator('#visual-media').evaluate(img=>img.decode());
  await page.locator('[data-action="tool-box"]').click();await drag(page,'#annotation-overlay',[.05,.08],[.24,.3]);
  await page.locator('[data-bind="object.label"]').fill('金属收纳盒');await save(page);let task=await savedTask(page,'SDR-001');assert.equal(task.regions.length,2);assert.equal(task.regions[1].label,'金属收纳盒');
  const before=task.regions[1].x;await page.locator('[data-action="tool-select"]').click();await drag(page,'#annotation-overlay',[.12,.18],[.19,.21]);await save(page);task=await savedTask(page,'SDR-001');assert(task.regions[1].x>before);
  await page.locator('[data-action="undo"]').click();await save(page);task=await savedTask(page,'SDR-001');assert(Math.abs(task.regions[1].x-before)<.01);
  await page.locator('[data-inspector-tab="annotation"]').click();await page.locator('[data-bind="task.caption"]').fill('银色笔记本电脑位于木桌中央，右侧有绿植。');await save(page);
 });
 await check('current annotation export excludes evaluation and temporary media URL',async()=>{
  await page.locator('[data-action="export"]').click();const exported=await captureDownload(page,()=>page.locator('[data-action="export-current"]').click());
  assert.equal(exported.kind,'annotation');assert(!Object.hasOwn(exported.task,'evaluation'));assert(!Object.hasOwn(exported.task.media,'url'));
  await page.locator('[data-action="close-modal"]') .first().click();
 });
 await check('video creates two keyframes with interpolation between, no extrapolation outside',async()=>{
  await page.locator('[data-modality="video"]').click();await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
  await page.locator('[data-action="tool-box"]').click();await drag(page,'#annotation-overlay',[.1,.5],[.24,.8]);
  await page.locator('#seek-slider').fill('2');await page.locator('#seek-slider').dispatchEvent('input');await page.waitForTimeout(150);
  await drag(page,'#annotation-overlay',[.45,.5],[.59,.8]);await save(page);
  const task=await savedTask(page,'SDA-001');assert.equal(task.tracks.length,1);assert.equal(task.tracks[0].keyframes.length,2);
  await page.locator('#seek-slider').fill('1');await page.locator('#seek-slider').dispatchEvent('input');await page.waitForTimeout(150);assert.equal(await page.locator('#annotation-overlay g').count(),1);
  await page.locator('#seek-slider').fill('3');await page.locator('#seek-slider').dispatchEvent('input');await page.waitForTimeout(150);assert.equal(await page.locator('#annotation-overlay g').count(),0);
  await page.locator('[data-action="next-frame"]').click();assert(await page.locator('video').evaluate(v=>v.currentTime>3));
 });
 await check('model scores and A/B results stay separate from annotation revisions',async()=>{
  const before=(await savedTask(page,'SDA-001')).revision;await page.locator('[data-phase="evaluation"]').click();await page.waitForSelector('[data-bind="rating.dim0"]');
  await page.locator('[data-bind="rating.dim0"]').selectOption('4');await page.locator('[data-bind="evaluation.outcome"]').selectOption('A更好');await page.waitForTimeout(600);
  const task=await savedTask(page,'SDA-001');assert.equal(task.evaluation.ratings.dim0,4);assert.equal(task.evaluation.outcome,'A更好');assert.equal(task.revision,before);
 });
 await check('local media import persists in IndexedDB across reload',async()=>{
  await page.locator('#media-import').setInputFiles(path.join(ROOT,'assets','meeting.wav'));await page.waitForSelector('audio',{state:'attached'});await page.waitForTimeout(500);await save(page);
  const task=(await getTasks(page)).find(task=>task.media.imported);assert(task);assert.equal(task.media.url,'');assert(task.media.peaks.length>0);
  await page.reload({waitUntil:'networkidle'});await page.locator(`[data-task="${task.id}"]`).click();await page.waitForFunction(()=>document.querySelector('audio')?.readyState>=2);assert(await page.locator('audio').evaluate(a=>a.src.startsWith('blob:')));
 });
 await check('backup recovery preserves existing tasks and rejects malformed data',async()=>{
  await page.locator('[data-action="export"]').click();const backup=await captureDownload(page,()=>page.locator('[data-action="export-backup"]').click());await page.locator('[data-action="close-modal"]') .first().click();
  const before=(await getTasks(page)).length;
  await page.locator('#backup-import').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.waitForTimeout(700);assert.equal((await getTasks(page)).length,before*2);
  await page.locator('#backup-import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":"annota/1","tasks":[null]}')});await page.locator('dialog[open]').waitFor();assert.equal((await getTasks(page)).length,before*2);await page.locator('[data-action="close-modal"]') .first().click();
 });
 await check('390px viewport has no document overflow in all three modes and phases',async()=>{
  await page.setViewportSize({width:390,height:844});
  for(const modality of ['audio','video','image'])for(const phase of ['annotation','review','evaluation']){
   await page.locator(`[data-modality="${modality}"]`).click();await page.locator(`[data-phase="${phase}"]`).click();await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${modality}/${phase}`);
  }
 });
 await check('corrupted storage is protected against automatic overwrite',async()=>{
  const protectedPage=await context.newPage();
  await protectedPage.addInitScript(()=>localStorage.setItem('annota_studio_v1','broken-json'));
  await protectedPage.goto('http://127.0.0.1:8768/',{waitUntil:'networkidle'});assert.equal(await protectedPage.evaluate(()=>localStorage.getItem('annota_studio_v1')),'broken-json');await protectedPage.close();
 });
 await check('double-click offline entry loads all media without external requests',async()=>{
  const offline=await context.newPage();offline.on('pageerror',error=>errors.push(error.message));const external=[];offline.on('request',request=>{if(/^https?:/.test(request.url()))external.push(request.url());});
  await offline.goto(pathToFileURL(path.join(ROOT,'打开演示.html')).href,{waitUntil:'load'});await offline.waitForFunction(()=>document.querySelector('audio')?.readyState>=2);
  await offline.locator('[data-modality="image"]').click();await offline.locator('#visual-media').evaluate(img=>img.decode());await offline.locator('[data-modality="video"]').click();await offline.waitForFunction(()=>document.querySelector('video')?.readyState>=2);assert.deepEqual(external,[]);await offline.close();
 });
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(ROOT,'docs','browser_verification.json'),JSON.stringify({date:'2026-10-29',checks,errors},null,2));
 await browser.close();
}
run().catch(error=>{fs.writeFileSync(path.join(ROOT,'docs','browser_verification.json'),JSON.stringify({checks,errors,failure:error.stack},null,2));process.stderr.write(error.stack);process.exit(1);});

