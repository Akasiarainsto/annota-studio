export function readWavMetadata(buffer) {
  const view=new DataView(buffer);if(view.byteLength<44)return null;
  const text=(offset,length)=>String.fromCharCode(...new Uint8Array(buffer,offset,length));
  if(text(0,4)!=='RIFF'||text(8,4)!=='WAVE')return null;
  let format=null,dataSize=null;
  for(let offset=12;offset+8<=view.byteLength;) {
    const id=text(offset,4),size=view.getUint32(offset+4,true);if(offset+8+size>view.byteLength)return null;
    if(id==='fmt '&&size>=16)format={channels:view.getUint16(offset+10,true),sample_rate_hz:view.getUint32(offset+12,true),byteRate:view.getUint32(offset+16,true)};
    if(id==='data')dataSize=size;
    offset+=8+size+(size%2);
  }
  if(!format||!format.byteRate||dataSize===null)return null;
  return {duration_s:dataSize/format.byteRate,sample_rate_hz:format.sample_rate_hz,channels:format.channels,sample_rate_origin:'wav_header'};
}
