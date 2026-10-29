export async function readAudioPeaks(file) {
  const context=new AudioContext();
  try {
    const decoded=await context.decodeAudioData(await file.arrayBuffer());const samples=decoded.getChannelData(0);const step=Math.max(1,Math.floor(samples.length/360));const peaks=[];
    for(let index=0;index<samples.length;index+=step){let peak=0;for(let cursor=index;cursor<Math.min(index+step,samples.length);cursor++)peak=Math.max(peak,Math.abs(samples[cursor]));peaks.push(peak);}return peaks;
  } finally {await context.close();}
}
export async function probeMedia(file) {
  const suffix=file.name.split('.').at(-1).toLowerCase();
  const modality=file.type.startsWith('image/')||['png','jpg','jpeg','webp','bmp','gif'].includes(suffix)?'image':file.type.startsWith('video/')||['mp4','webm','mov','mkv','avi'].includes(suffix)?'video':'audio';
  const url=URL.createObjectURL(file);
  try {
    if(modality==='image'){const image=new Image();image.src=url;await image.decode();return {modality,width:image.naturalWidth,height:image.naturalHeight,duration:0};}
    const player=document.createElement(modality==='audio'?'audio':'video');player.preload='metadata';
    const metadata=await new Promise((resolve,reject)=>{player.onloadedmetadata=()=>resolve({duration:player.duration,width:player.videoWidth||0,height:player.videoHeight||0});player.onerror=()=>reject(new Error('浏览器无法解码此素材，请使用受支持的格式'));player.src=url;});
    player.removeAttribute('src');player.load();if(!Number.isFinite(metadata.duration)||metadata.duration<=0)throw new Error('素材没有有效时长');
    return {modality,...metadata,...modality==='audio'?{peaks:await readAudioPeaks(file)}:{}};
  } finally {URL.revokeObjectURL(url);}
}
