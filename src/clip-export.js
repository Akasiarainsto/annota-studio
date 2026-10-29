import {encodeWav} from './wav-encoder.js';
import {repairWebm} from '../vendor/webm-duration.js';

function waitMedia({player,event,signal}) {
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{player.removeEventListener(event,ready);player.removeEventListener('error',failed);signal?.removeEventListener('abort',aborted);};
    const ready=()=>{cleanup();resolve();};const failed=()=>{cleanup();reject(new Error('浏览器无法解码源媒体'));};const aborted=()=>{cleanup();reject(new DOMException('导出已取消','AbortError'));};
    if(signal?.aborted){aborted();return;}player.addEventListener(event,ready,{once:true});player.addEventListener('error',failed,{once:true});signal?.addEventListener('abort',aborted,{once:true});
  });
}
async function exportAudio(blob,options) {
  const context=new AudioContext();
  try{const decoded=await context.decodeAudioData(await blob.arrayBuffer());options.signal?.throwIfAborted();if(options.end>decoded.duration+.02)throw new Error('片段超出实际音频时长');return encodeWav(decoded,options);}
  finally {await context.close();}
}
async function recordVideo(player,options) {
  const audio=new AudioContext();try{await audio.resume();}catch(error){await audio.close();throw error;}
  return new Promise((resolve,reject)=>{
    const canvas=document.createElement('canvas');canvas.width=player.videoWidth;canvas.height=player.videoHeight;const painter=canvas.getContext('2d');
    const stream=canvas.captureStream(30),destination=audio.createMediaStreamDestination();audio.createMediaElementSource(player).connect(destination);destination.stream.getAudioTracks().forEach(track=>stream.addTrack(track));
    const mime='video/webm;codecs=vp8,opus';const recorder=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported(mime)?mime:'video/webm'});const chunks=[];let frame=0;let cancelled=false;const started=performance.now();
    const finish=()=>{if(recorder.state!=='inactive')recorder.stop();player.pause();};
    const abort=()=>{cancelled=true;finish();};
    recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
    recorder.onerror=event=>{cancelled=true;finish();reject(new Error(event.error?.message||'视频编码失败'));};
    recorder.onstop=async()=>{
      cancelAnimationFrame(frame);stream.getTracks().forEach(track=>track.stop());options.signal?.removeEventListener('abort',abort);document.removeEventListener('visibilitychange',hidden);await audio.close();
      if(cancelled){reject(new DOMException('导出已取消','AbortError'));return;}
      try{resolve(await repairWebm(new Blob(chunks,{type:'video/webm'}),performance.now()-started));}catch(error){reject(error);}
    };
    const draw=()=>{painter.drawImage(player,0,0,canvas.width,canvas.height);options.onProgress?.(Math.min(1,(player.currentTime-options.start)/(options.end-options.start)));if(player.currentTime>=options.end||player.ended){finish();return;}frame=requestAnimationFrame(draw);};
    const hidden=()=>{if(document.hidden)abort();};document.addEventListener('visibilitychange',hidden);
    options.signal?.addEventListener('abort',abort,{once:true});
    const begin=async()=>{recorder.start(100);try{await player.play();draw();}catch(error){cancelled=true;finish();reject(error);}};void begin();
  });
}
async function exportVideo(blob,options) {
  if(!globalThis.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)throw new Error('当前浏览器不支持视频片段编码，请使用新版 Edge 或 Chrome');
  const player=document.createElement('video');const url=URL.createObjectURL(blob);player.preload='auto';player.muted=true;player.playsInline=true;
  try {
    const metadata=waitMedia({player,event:'loadedmetadata',signal:options.signal});player.src=url;await metadata;
    if(!Number.isFinite(player.duration)||options.end>player.duration+.05)throw new Error('片段超出实际视频时长');
    if(player.readyState<2)await waitMedia({player,event:'loadeddata',signal:options.signal});
    if(options.start>0){const seeked=waitMedia({player,event:'seeked',signal:options.signal});player.currentTime=options.start;await seeked;}
    return await recordVideo(player,options);
  } finally {player.pause();player.removeAttribute('src');player.load();URL.revokeObjectURL(url);}
}
export async function exportMediaClip({task,segment,sourceBlob,signal,onProgress}) {
  if(!segment||!Number.isFinite(segment.start)||!Number.isFinite(segment.end)||segment.end<=segment.start)throw new Error('请先选择起止时间有效的片段');
  let blob=sourceBlob;
  if(!blob){const response=await fetch(task.media.url,{signal});if(!response.ok)throw new Error('读取源媒体失败');blob=await response.blob();}
  signal?.throwIfAborted();const options={start:segment.start,end:segment.end,signal,onProgress};
  const result=task.modality==='audio'?await exportAudio(blob,options):await exportVideo(blob,options);
  const extension=task.modality==='audio'?'wav':'webm';return {blob:result,filename:`${task.media.name.replace(/\.[^.]+$/,'')}_${segment.start.toFixed(3)}-${segment.end.toFixed(3)}.${extension}`};
}
