const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/29346/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT=path.resolve(__dirname,'..');const checks=[];const errors=[];
async function check(name,operation){await operation();checks.push(name);process.stdout.write(`PASS ${name}\n`);}
async function runCheck(page){await page.locator('[data-json-action="run"]').click();}
async function chooseCase(page,key){await page.locator('#json-case-select').selectOption(key);await runCheck(page);}
async function download(page,action){const pending=page.waitForEvent('download');await action();return fs.readFileSync(await (await pending).path(),'utf8');}
async function run(){
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:1500,height:1050},acceptDownloads:true});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(ROOT,'打开演示.html')).href,{waitUntil:'load'});await page.waitForFunction(()=>document.querySelector('audio')?.readyState>=2);
 await page.locator('.heading_actions [data-action="save"]').click();const before=await page.evaluate(()=>localStorage.getItem('annota_studio_v1'));
 await check('validator follows the active audio task and displays the Dolphin training schema',async()=>{
  await page.locator('.app_rail [data-action="json-validate"]').click();await page.waitForFunction(()=>document.querySelector('#json-summary').textContent.includes('音频规则通过'));
  assert.match(await page.locator('#modal-title').textContent(),/Dolphin.*音频/);const value=JSON.parse(await page.locator('#json-editor').inputValue());assert(value[0].audio_file);assert(value[0].segments[0].text);assert(!value[0].media);assert(!value[0].captions);
 });
 await check('audio cases distinguish timing, transcript, speaker, noise, overlap and dialect',async()=>{
  const cases={time_out:'TIME_OUT_OF_BOUNDS',reversed:'SEGMENT_ORDER',missing:'TRANSCRIPT_MISSING',speaker:'SPEAKER_MISSING',noise:'NOISE_TAG_MISSING',overlap:'AUDIO_OVERLAP',attribute:'DIALECT_ENUM'};
  for(const [key,code]of Object.entries(cases)){await chooseCase(page,key);assert.match(await page.locator('#json-issues').textContent(),new RegExp(code));}
  await chooseCase(page,'invalid');assert.match(await page.locator('#json-summary').textContent(),/5 条.*5 不通过.*5 个问题/);await page.screenshot({path:path.join(ROOT,'docs/json_audio_v2.png')});
 });
 await check('audio edit, exact problem location, recheck and corrected five-record example work',async()=>{
  await chooseCase(page,'speaker');await page.locator('.json_issue').click();assert.equal(await page.locator('#json-editor').evaluate(e=>e.value.slice(e.selectionStart,e.selectionEnd)),'""');
  const value=JSON.parse(await page.locator('#json-editor').inputValue());value[0].segments[0].speaker='speaker_1';await page.locator('#json-editor').fill(JSON.stringify(value,null,2));assert(await page.locator('[data-json-action="report"]').isDisabled());await runCheck(page);assert.match(await page.locator('#json-summary').textContent(),/音频规则通过/);
  await page.locator('[data-json-action="corrected"]').click();await runCheck(page);assert.match(await page.locator('#json-summary').textContent(),/5 条.*5 通过.*0 不通过/);
 });
 await check('video has a distinct seven-caption schema and explicit overlap reasoning',async()=>{
  await page.locator('[data-json-mode="video"]').click();const value=JSON.parse(await page.locator('#json-editor').inputValue());assert(value[0].video_path);assert.equal(value[0].segments[0].captions.length,7);assert(!value[0].audio_file);
  for(const [key,code]of Object.entries({time_out:'TIME_OUT_OF_BOUNDS',reversed:'SEGMENT_ORDER',missing:'CAPTION_MISSING',overlap:'OVERLAP_REASON',caption_count:'CAPTION_COUNT'})){await chooseCase(page,key);assert.match(await page.locator('#json-issues').textContent(),new RegExp(code));}
  await chooseCase(page,'invalid');assert.match(await page.locator('#json-summary').textContent(),/3 条.*3 不通过.*3 个问题/);await page.screenshot({path:path.join(ROOT,'docs/json_video_v2.png')});
  await page.locator('[data-json-action="corrected"]').click();await runCheck(page);assert.match(await page.locator('#json-summary').textContent(),/3 条.*3 通过/);
 });
 await check('image schema checks Caption, labels, paths and actual loaded file inventory',async()=>{
  await page.locator('[data-json-mode="image"]').click();const value=JSON.parse(await page.locator('#json-editor').inputValue());assert(value[0].image_path);assert(value[0].caption);assert(!value[0].segments);
  assert.equal(await page.locator('#json-image-scope').isVisible(),true);assert.match(await page.locator('#json-summary').textContent(),/图片规则通过.*2 条/);
  for(const [key,code]of Object.entries({practice_before:'MISSING_FIELD',tag_error:'TAG_ENUM',missing_file:'IMAGE_MISSING',path_escape:'IMAGE_PATH'})){await chooseCase(page,key);assert.match(await page.locator('#json-issues').textContent(),new RegExp(code));}
  await chooseCase(page,'invalid');assert.match(await page.locator('#json-summary').textContent(),/13 条.*13 不通过.*17 个问题/);assert.match(await page.locator('#json-issues').textContent(),/DUPLICATE_ID/);assert.match(await page.locator('#json-issues').textContent(),/CROSS_SPLIT_IMAGE/);await page.screenshot({path:path.join(ROOT,'docs/json_image_v2.png')});
 });
 await check('selecting a real image directory changes scope and invalidates old results',async()=>{
  await chooseCase(page,'valid');await page.locator('#json-image-folder').setInputFiles(path.join(ROOT,'examples/image'));
  assert(await page.locator('[data-json-action="report"]').isDisabled());await runCheck(page);assert.match(await page.locator('#json-summary').textContent(),/图片规则通过/);assert.match(await page.locator('#json-inventory-status').textContent(),/用户选择/);
 });
 await check('JSONL import continues after a syntax error and identifies physical lines',async()=>{
  await page.locator('[data-json-mode="video"]').click();await chooseCase(page,'time_out');const record=JSON.parse(await page.locator('#json-editor').inputValue())[0];
  await page.locator('#json-file-input').setInputFiles({name:'video_cases.jsonl',mimeType:'text/plain',buffer:Buffer.from('{\n\n'+JSON.stringify(record))});await page.waitForFunction(()=>document.querySelector('#json-format').value==='jsonl'&&document.querySelector('#json-summary').textContent.includes('2 条'));
  assert.match(await page.locator('#json-issues').textContent(),/第 1 行/);assert.match(await page.locator('#json-issues').textContent(),/第 3 行/);
 });
 await check('CSV, report and edited-data downloads are modality-specific and current',async()=>{
  const report=JSON.parse(await download(page,()=>page.locator('[data-json-action="report"]').click()));assert.equal(report.modality,'video');assert.equal(report.failed,2);assert.equal(report.timeBasis,'json_declared_duration');
  const csv=await download(page,()=>page.locator('[data-json-action="csv"]').click());assert.match(csv,/TIME_OUT_OF_BOUNDS/);
  await chooseCase(page,'corrected');const edited=JSON.parse(await download(page,()=>page.locator('[data-json-action="download"]').click()));assert.equal(edited.length,3);assert(edited[0].video_path);
 });
 await check('wrong modality is rejected, independent drafts survive switching, and tasks remain unchanged',async()=>{
  const videoText=await page.locator('#json-editor').inputValue();await page.locator('[data-json-mode="audio"]').click();await page.locator('#json-editor').fill(videoText);await runCheck(page);assert.match(await page.locator('#json-issues').textContent(),/MODALITY_MISMATCH/);
  const retained=await page.locator('#json-editor').inputValue();await page.locator('[data-json-mode="image"]').click();await page.locator('[data-json-mode="audio"]').click();assert.equal(await page.locator('#json-editor').inputValue(),retained);
  assert.equal(await page.evaluate(()=>localStorage.getItem('annota_studio_v1')),before);
 });
 await check('all modality views remain usable at 390px and cleanup restores the regular dialog',async()=>{
  await page.setViewportSize({width:390,height:844});for(const mode of ['audio','video','image']){await page.locator(`[data-json-mode="${mode}"]`).click();await chooseCase(page,'invalid');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const box=await page.locator('dialog').boundingBox();assert(box.x>=0&&box.x+box.width<=390);}
  await page.screenshot({path:path.join(ROOT,'docs/json_modality_mobile.png')});await page.locator('[data-action="close-modal"]').first().click();await page.setViewportSize({width:1500,height:1050});assert.equal(await page.locator('dialog').evaluate(d=>d.classList.contains('json_validator_modal')),false);
 });
 await check('live required-field feedback saves drafts but blocks submission and approval',async()=>{
  await page.locator('[data-bind="segment.text"]').fill('');assert.match(await page.locator('#live-validation').textContent(),/待修正/);await page.locator('.heading_actions [data-action="save"]').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('annota_studio_v1')).tasks[0].segments[0].text),'');
  await page.locator('[data-action="submit"]').click();assert.match(await page.locator('#modal-body').textContent(),/转写缺失/);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('annota_studio_v1')).tasks[0].status),'draft');await page.screenshot({path:path.join(ROOT,'docs/submission_blocked.png')});await page.locator('[data-action="close-modal"]').first().click();
  await page.locator('[data-phase="review"]').click();assert(await page.locator('[data-action="approve"]').isDisabled());await page.locator('[data-phase="annotation"]').click();await page.locator('[data-bind="segment.text"]').fill('今天下午三点，');assert.match(await page.locator('#live-validation').textContent(),/即时规则通过/);await page.locator('[data-action="submit"]').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('annota_studio_v1')).tasks[0].status),'pending');
 });
 await check('video time order is checked immediately and prevents the status transition',async()=>{
  await page.locator('[data-modality="video"]').click();await page.locator('[data-bind="segment.end"]').fill('0');assert.match(await page.locator('#live-validation').textContent(),/待修正/);await page.locator('[data-action="submit"]').click();assert.match(await page.locator('#modal-body').textContent(),/结束时间必须大于开始时间/);await page.locator('[data-action="close-modal"]').first().click();await page.locator('[data-bind="segment.end"]').fill('3.9');assert.match(await page.locator('#live-validation').textContent(),/即时规则通过/);await page.screenshot({path:path.join(ROOT,'docs/live_validation.png')});
 });
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(ROOT,'docs/json_validator_verification.json'),JSON.stringify({date:'2026-10-29',version:2,checks,errors},null,2));await browser.close();
}
run().catch(error=>{fs.writeFileSync(path.join(ROOT,'docs/json_validator_verification.json'),JSON.stringify({checks,errors,failure:error.stack},null,2));process.stderr.write(error.stack);process.exit(1);});
