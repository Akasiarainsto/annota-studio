export function requireCondition(condition,status,message) {
  if(!condition)throw Object.assign(new Error(message),{status});
}
export function requireObject(value,label='JSON') {
  requireCondition(value&&typeof value==='object'&&!Array.isArray(value),400,`${label}必须为对象`);return value;
}
export async function readJson(request) {
  const buffer=await readBytes(request,2*1024*1024);
  try{return requireObject(JSON.parse(new TextDecoder().decode(buffer)));}
  catch {throw Object.assign(new Error('请求不是有效 JSON'),{status:400});}
}
export async function readBytes(request,limit) {
  requireCondition(Number(request.headers.get('content-length')||0)<=limit,413,'文件或请求体超过大小限制');
  const reader=request.body?.getReader();if(!reader)return new Uint8Array();
  const chunks=[];let length=0;
  for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();requireCondition(false,413,'文件或请求体超过大小限制');}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
export function requireText(value,label,max=5000) {
  requireCondition(typeof value==='string'&&value.trim().length>0&&value.length<=max,400,`${label}必填且长度不能超过 ${max}`);return value.trim();
}
