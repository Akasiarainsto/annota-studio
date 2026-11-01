import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {once} from 'node:events';
import {startStaticServer} from './static-server.mjs';

const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/29346/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const DATA_ROOT=await mkdtemp(join(tmpdir(),'annota-interactions-')),EVIDENCE=resolve('evidence');await mkdir(EVIDENCE,{recursive:true});
const server=startStaticServer();await once(server,'listening');const BASE=process.env.ANNOTA_BASE_URL||('http://127.0.0.1:'+server.address().port+'/annota-studio');
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[],steps=[];page.on('pageerror',error=>errors.push(error.stack));
const editor=()=>page.locator('#json-editor');
async function checkCode(code){await page.waitForFunction(code=>document.querySelector('#json-results')?.textContent.includes(code),code);}
async function videoRange(start,end){await page.locator('[data-video-action=range]').click();const rect=await page.locator('.waveform').boundingBox();await page.mouse.move(rect.x+rect.width*start/8,rect.y+rect.height*.55);await page.mouse.down();await page.mouse.move(rect.x+rect.width*end/8,rect.y+rect.height*.55,{steps:12});await page.mouse.up();await page.locator('.time-range-bar').waitFor();}
async function saveDownload(button,filename){const promise=page.waitForEvent('download',{timeout:45000});await button.click();const download=await promise;await download.saveAs(join(EVIDENCE,filename));return join(EVIDENCE,filename);}
let passed=false;
try{
  await page.goto(BASE);await page.getByRole('button',{name:'登录工作区'}).click();await page.locator('[data-nav=json]').click();await editor().waitFor();
  const cases={audio:[['range','E_TIME_OUT_OF_RANGE'],['speaker','E_SPEAKER_REF'],['text','E_REQUIRED']],video:[['range','E_VIDEO_TIME_OUT_OF_RANGE'],['dimensions','E_VIDEO_DIMENSIONS'],['overlap','E_VIDEO_OVERLAP']],image:[['range','E_BOX_BOUNDS'],['tags','E_IMAGE_TAGS'],['text','E_REQUIRED']]};
  for(const [modality,examples] of Object.entries(cases)){
    await page.locator(`[data-json-modality=${modality}]`).click();await page.waitForFunction(modality=>{const input=document.querySelector('#json-editor');return input&&JSON.parse(input.value).modality===modality;},modality);
    await page.locator('#json-good').click();await page.waitForFunction(()=>document.querySelector('#json-results').textContent.includes('检查通过'));const valid=await editor().inputValue();
    for(const [kind,code] of examples){
      await page.locator('#json-error-type').selectOption(kind);await checkCode(code);assert.ok((await page.locator('#json-doc-label').innerText()).includes('已载入'));assert.equal(await page.locator('#json-check').isEnabled(),true);
      if(kind==='dimensions')assert.equal(Object.hasOwn(JSON.parse(await editor().inputValue()).segments[0],'dimensions'),false);
      await page.locator('#json-check').click();await checkCode(code);
      await page.locator('[data-json-error]').first().click();assert.ok(await editor().evaluate(node=>node.selectionEnd>node.selectionStart));
      await editor().fill(valid);assert.ok((await page.locator('#json-results').innerText()).includes('待重新校验'));assert.ok(!(await page.locator('#json-results').innerText()).includes('检查通过'));
      assert.equal(await page.locator('#json-apply').isDisabled(),true);await page.locator('#json-check').click();assert.ok((await page.locator('#json-results').innerText()).includes('检查通过'));assert.equal(await page.locator('#json-error-type').inputValue(),kind,'result follows actual text, not selected error name');
      await page.locator('#json-bad').click();await checkCode(code);
    }
  }
  steps.push('all nine error selections auto-load actual bad JSON; repaired JSON passes independent of case selector');
  await page.locator('[data-json-modality=video]').click();await page.locator('#json-error-type').selectOption('dimensions');await checkCode('E_VIDEO_DIMENSIONS');await page.screenshot({path:join(EVIDENCE,'json_video_missing_dimensions.png')});
  const reportFile=await saveDownload(page.locator('#json-report'),'json_actual_error_report.json');const report=JSON.parse(await readFile(reportFile,'utf8'));assert.equal(report.valid,false);assert.ok(report.issues.some(issue=>issue.code==='E_VIDEO_DIMENSIONS'));
  const document=JSON.parse(await editor().inputValue());document.segments[0].dimensions={subject:'person',action:'contact',camera:'fixed',lighting:'lowlight',physical_dynamics:'suspect',material:'mixed',interaction:'contact'};await editor().fill(JSON.stringify(document,null,2));await page.screenshot({path:join(EVIDENCE,'json_edited_pending.png')});await page.locator('#json-check').click();assert.ok((await page.locator('#json-results').innerText()).includes('检查通过'));
  await editor().fill(JSON.stringify(document)+'\n'+JSON.stringify(document));await page.locator('#json-check').click();await checkCode('E_DUPLICATE_TASK_ID');steps.push('stale pass invalidated on input, report matches current text, JSONL checked');
  await page.goto(BASE+'/?task=V-001');await page.locator('[data-video-action=merge]').waitFor();assert.equal(await page.locator('[data-history=undo]').isDisabled(),true);
  const secondCaption=await page.locator('[data-text-field=caption][data-index="1"]').inputValue();await page.locator('[data-video-action=merge]').click();assert.equal(await page.locator('[data-select-segment]').count(),3);assert.equal(await page.locator('[data-history=undo]').isEnabled(),true);
  await page.locator('[data-history=undo]').click();assert.equal(await page.locator('[data-select-segment]').count(),4);assert.equal(await page.locator('[data-text-field=caption][data-index="1"]').inputValue(),secondCaption);
  await page.locator('[data-history=redo]').click();assert.equal(await page.locator('[data-select-segment]').count(),3);await page.locator('[data-history=undo]').click();assert.equal(await page.locator('[data-select-segment]').count(),4);
  for(let index=0;index<3;index++)await page.locator('[data-video-action=merge]').click();assert.equal(await page.locator('[data-select-segment]').count(),1);await page.screenshot({path:join(EVIDENCE,'video_merge_undo_controls.png')});steps.push('video merge undo and redo restore original segments and captions');
  await videoRange(1,3);assert.equal(await page.locator('[data-select-segment]').count(),1);assert.equal(await page.locator('[data-time-field=end_s]').inputValue(),'8');assert.equal(await page.locator('.range-error').isHidden(),true);await page.screenshot({path:join(EVIDENCE,'video_drag_range_actions.png')});
  await page.locator('[data-range-action=replace]').click();assert.ok(Math.abs(Number(await page.locator('[data-time-field=start_s]').inputValue())-1)<.01);assert.ok(Math.abs(Number(await page.locator('[data-time-field=end_s]').inputValue())-3)<.01);assert.equal(await page.locator('[data-confirm-boundary]').isChecked(),false);await page.locator('[data-history=undo]').click();assert.equal(await page.locator('[data-time-field=end_s]').inputValue(),'8');
  await videoRange(1,3);await page.locator('[data-range-action=new]').click();assert.ok((await page.locator('.range-error').innerText()).includes('VS01'));assert.equal(await page.locator('[data-select-segment]').count(),1);await page.locator('[data-range-action=cancel]').click();
  await videoRange(1,3);await saveDownload(page.locator('[data-range-action=export]'),'video_drag_selected_range.webm');assert.equal(await page.locator('[data-select-segment]').count(),1);await page.locator('[data-range-action=cancel]').click();
  await page.locator('[data-time-field=end_s]').fill('2');await page.locator('[data-time-field=end_s]').press('Tab');await videoRange(3,4);await page.locator('[data-range-action=new]').click();assert.equal(await page.locator('[data-select-segment]').count(),2);await page.locator('[data-history=undo]').click();assert.equal(await page.locator('[data-select-segment]').count(),1);steps.push('drag selects without mutations; apply, real export, overlap guidance and empty-gap creation work');
  await page.setViewportSize({width:1366,height:768});assert.equal(await page.locator('[data-history=undo]').isVisible(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);passed=true;process.stdout.write(steps.map(step=>'PASS '+step).join('\n')+'\n');
}catch(error){process.stderr.write(error.stack+'\n');await page.screenshot({path:join(EVIDENCE,'interaction_failure.png')});process.exitCode=1;}
finally{await writeFile(join(EVIDENCE,'pages_interactions_report.json'),JSON.stringify({passed,steps,consoleErrors:errors},null,2));await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));assert.ok(DATA_ROOT.startsWith(join(tmpdir(),'annota-interactions-')));await rm(DATA_ROOT,{recursive:true,force:true});}
