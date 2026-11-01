export async function readMedia(url,options={}) {
  // Use the same byte-range transport as native media playback, including local browser/proxy environments.
  const response=await fetch(url,{headers:{Range:'bytes=0-'},signal:options.signal});
  if(response.status!==200&&response.status!==206)throw new Error(`无法读取媒体内容（HTTP ${response.status}）`);
  const blob=await response.blob();if(!blob.size)throw new Error('媒体读取结果为空，请检查本地服务');return blob;
}
