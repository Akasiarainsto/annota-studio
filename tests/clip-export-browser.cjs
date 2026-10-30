const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('C:/Users/29346/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const BASE_URL=process.env.ANNOTA_BASE_URL||'http://127.0.0.1:8768/';
const checks=[],errors=[];
async function check(name,operation){await operation();checks.push(name);process.stdout.write(`PASS ${name}\n`);}
async function generateVideo(){
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const painter=canvas.getContext('2d');let frame;
  function draw(){painter.fillStyle='#202439';painter.fillRect(0,0,320,180);painter.fillStyle='#8b83ff';painter.fillRect((performance.now()/10)%280,60,40,40);frame=requestAnimationFrame(draw);}draw();
  const audio=new AudioContext();await audio.resume();const oscillator=audio.createOscillator(),gain=audio.createGain(),destination=audio.createMediaStreamDestination();
  gain.gain.value=.2;oscillator.frequency.value=440;oscillator.connect(gain).connect(destination);oscillator.start();
  const stream=canvas.captureStream(30);destination.stream.getAudioTracks().forEach(track=>stream.addTrack(track));
  const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus'}),chunks=[];recorder.ondataavailable=event=>chunks.push(event.data);
  const stopped=new Promise(resolve=>{recorder.onstop=resolve;});recorder.start(100);await new Promise(resolve=>setTimeout(resolve,12200));recorder.stop();await stopped;
  cancelAnimationFrame(frame);oscillator.stop();stream.getTracks().forEach(track=>track.stop());await audio.close();
  const {repairWebm}=await import('./vendor/webm-duration.js');window.clipFixture=await repairWebm(new Blob(chunks,{type:'video/webm'}),12200);
}
async function run(){
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto(BASE_URL);await page.bringToFront();await page.locator('body').click({position:{x:5,y:5}});await page.evaluate(generateVideo);
    let videoResults;
    await check('3/5/10-second video exports decode with non-silent audio',async()=>{
      videoResults=await page.evaluate(async()=>{
        const {exportMediaClip}=await import('./src/clip-export.js');const rows=[];
        for(const seconds of [3,5,10]){
          const result=await exportMediaClip({task:{modality:'video',media:{name:'fixture.webm'}},segment:{start:.5,end:.5+seconds},sourceBlob:window.clipFixture});
          const audio=new AudioContext(),decoded=await audio.decodeAudioData(await result.blob.arrayBuffer()),samples=decoded.getChannelData(0);
          const rms=Math.sqrt(samples.reduce((sum,value)=>sum+value*value,0)/samples.length);await audio.close();
          const player=document.createElement('video'),url=URL.createObjectURL(result.blob);player.src=url;await new Promise((resolve,reject)=>{player.onloadedmetadata=resolve;player.onerror=reject;});
          rows.push({seconds,duration:player.duration,rms,bytes:result.blob.size});URL.revokeObjectURL(url);
        }return rows;
      });for(const row of videoResults){assert(Math.abs(row.duration-row.seconds)<.25,JSON.stringify(row));assert(row.rms>.01,JSON.stringify(row));}
    });
    await check('3/5/10-second WAV exports contain the expected PCM samples',async()=>{
      const results=await page.evaluate(async()=>{
        const {encodeWav}=await import('./src/wav-encoder.js'),{exportMediaClip}=await import('./src/clip-export.js');
        const buffer=new AudioBuffer({length:48000*12,numberOfChannels:1,sampleRate:48000}),samples=buffer.getChannelData(0);
        for(let index=0;index<samples.length;index++)samples[index]=.2*Math.sin(index*2*Math.PI*440/48000);
        const sourceBlob=encodeWav(buffer,{start:0,end:12}),rows=[];
        for(const seconds of [3,5,10]){const result=await exportMediaClip({task:{modality:'audio',media:{name:'fixture.wav'}},segment:{start:1,end:1+seconds},sourceBlob});const audio=new AudioContext(),decoded=await audio.decodeAudioData(await result.blob.arrayBuffer());rows.push({seconds,duration:decoded.duration});await audio.close();}return rows;
      });for(const row of results)assert.equal(row.duration,row.seconds);
    });
    await check('cancellation rejects rather than returning a partial successful file',async()=>{
      const result=await page.evaluate(async()=>{const {exportMediaClip}=await import('./src/clip-export.js');const abort=new AbortController();setTimeout(()=>abort.abort(),250);try{await exportMediaClip({task:{modality:'video',media:{name:'fixture.webm'}},segment:{start:.5,end:10.5},sourceBlob:window.clipFixture,signal:abort.signal});return 'unexpected success';}catch(error){return error.name;}});assert.equal(result,'AbortError');
    });
    await check('unsupported video recording gives an actionable browser error',async()=>{
      const result=await page.evaluate(async()=>{const {exportMediaClip}=await import('./src/clip-export.js'),capture=HTMLCanvasElement.prototype.captureStream;HTMLCanvasElement.prototype.captureStream=undefined;try{await exportMediaClip({task:{modality:'video',media:{name:'fixture.webm'}},segment:{start:0,end:3},sourceBlob:window.clipFixture});}catch(error){return error.message;}finally{HTMLCanvasElement.prototype.captureStream=capture;}});assert.match(result,/Edge.*Chrome/);
    });
    await check('quick clip creates aligned timestamps and UI downloads a real WAV',async()=>{
      await page.locator('#media-import').setInputFiles({name:'export_fixture.wav',mimeType:'audio/wav',buffer:fs.readFileSync(path.join(__dirname,'..','assets','meeting.wav'))});
      await page.waitForFunction(()=>document.querySelector('#media-player')?.src.startsWith('blob:')&&document.querySelector('#media-player')?.duration>4.8);
      await page.locator('#clip-duration').selectOption('3');await page.locator('[data-action="quick-clip"]').click();
      assert.equal(await page.locator('[data-bind="segment.start"]').inputValue(),'0');assert.equal(await page.locator('[data-bind="segment.end"]').inputValue(),'3');
      const [file]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="export-clip"]').click()]);const bytes=fs.readFileSync(await file.path());assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert(bytes.length>100000);
    });
    assert.deepEqual(errors,[]);const report={time:new Date().toISOString(),baseUrl:BASE_URL,checks,videoResults,errors};
    fs.writeFileSync(path.join(__dirname,'..','docs',process.env.ANNOTA_BASE_URL?'pages_clip_verification.json':'clip_verification.json'),JSON.stringify(report,null,2));
  }finally{await browser.close();}
}
run().catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1;});
