export function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
export function formatTime(value=0) {
  const seconds=Math.max(0,Number.isFinite(value)?value:0);
  return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${(seconds%60).toFixed(2).padStart(5,'0')}`;
}
export function createId(prefix='item') {
  return `${prefix}_${crypto.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2,8)}`;
}
export function downloadJson(filename,value) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'}));
  const anchor=Object.assign(document.createElement('a'),{href:url,download:filename});
  anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
