import {uploadFile} from './api.js';
import {readWavMetadata} from '../core/wav-metadata.js';

async function readMetadata(file,modality) {
  const url=URL.createObjectURL(file);
  try {
    if(modality==='audio') {
      if(file.name.toLowerCase().endsWith('.wav')){const header=readWavMetadata(await file.arrayBuffer());if(header)return header;}
      const context=new AudioContext();
      try{const buffer=await context.decodeAudioData(await file.arrayBuffer());return {duration_s:buffer.duration,sample_rate_hz:buffer.sampleRate,channels:buffer.numberOfChannels,sample_rate_origin:'decoded'};}finally{await context.close();}
    }
    if(modality==='image') {
      const image=new Image();const ready=new Promise((resolve,reject)=>{image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(new Error('图片解码失败'));});image.src=url;return await ready;
    }
    const video=document.createElement('video');video.preload='metadata';
    const ready=new Promise((resolve,reject)=>{video.onloadedmetadata=()=>resolve({duration_s:video.duration,fps:24});video.onerror=()=>reject(new Error('视频解码失败'));});video.src=url;
    try{const metadata=await ready;if(!Number.isFinite(metadata.duration_s))throw new Error('无法取得有限的视频时长');return metadata;}finally{video.removeAttribute('src');video.load();}
  }finally{URL.revokeObjectURL(url);}
}
export async function importMedia(file) {
  const extension=file.name.split('.').pop().toLowerCase();
  const modality=['wav','mp3','m4a'].includes(extension)?'audio':['mp4','webm'].includes(extension)?'video':['jpg','jpeg','png'].includes(extension)?'image':null;
  if(!modality)throw new Error('请选择 WAV/MP3/M4A、MP4/WebM、JPG/PNG 文件');
  if(file.size>100*1024*1024)throw new Error('本地演示导入单个文件上限为 100 MB');
  const metadata=await readMetadata(file,modality);const uploaded=await uploadFile(file);
  const media={id:'import-'+crypto.randomUUID(),url:uploaded.url,...metadata};
  // Browser metadata does not expose an authoritative video FPS. It is explicitly editable before annotation.
  const document={schema_version:'1.0',modality,task_id:'pending',media};
  if(modality==='audio')Object.assign(document,{speakers:[{id:'S1'}],segments:[]});
  if(modality==='video')Object.assign(document,{segments:[],fps_notice:'24 为导入参考值，需在规范面板核对原片帧率；本地浏览器不自动测量帧率'});
  if(modality==='image')Object.assign(document,{caption:'',scene:'',lighting:'',tags:[],boxes:[],content_confirmed:false});
  return {label:file.name,document};
}
