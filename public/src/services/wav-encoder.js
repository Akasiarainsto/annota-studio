export function encodeWav(buffer,{start,end}) {
  const first=Math.max(0,Math.round(start*buffer.sampleRate));const last=Math.min(buffer.length,Math.round(end*buffer.sampleRate));
  if(last<=first)throw new Error('片段范围没有有效音频采样');
  const channels=buffer.numberOfChannels;const frames=last-first;const bytes=frames*channels*2;
  const result=new ArrayBuffer(44+bytes),view=new DataView(result);
  const writeText=(offset,text)=>{for(let index=0;index<text.length;index++)view.setUint8(offset+index,text.charCodeAt(index));};
  writeText(0,'RIFF');view.setUint32(4,36+bytes,true);writeText(8,'WAVE');writeText(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);writeText(36,'data');view.setUint32(40,bytes,true);
  const samples=Array.from({length:channels},(_,index)=>buffer.getChannelData(index));let offset=44;
  for(let frame=first;frame<last;frame++)for(let channel=0;channel<channels;channel++){const value=Math.max(-1,Math.min(1,samples[channel][frame]));view.setInt16(offset,value<0?value*32768:value*32767,true);offset+=2;}
  return new Blob([result],{type:'audio/wav'});
}
