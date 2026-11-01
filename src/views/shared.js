export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const STATUS={draft:'待标注',pending:'待双人复核',disputed:'待仲裁',returned:'退回修订',approved:'已验收',correction_pending:'复核更正待处理'};
export const MODALITY={audio:'音频',video:'视频',image:'图片'};
export const time=value=>Number.isFinite(value)?`${Math.floor(value/60).toString().padStart(2,'0')}:${(value%60).toFixed(3).padStart(6,'0')}`:'--:--.---';
export const clock=value=>{const seconds=Math.floor(value);return `${Math.floor(seconds/3600).toString().padStart(2,'0')}:${Math.floor(seconds/60%60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;};
export const badge=status=>`<span class="badge ${status}">${STATUS[status]||escapeHtml(status)}</span>`;
export function optionButtons(options,value,key,disabled=false) {
  return `<div class="choice-group" role="group">${options.map(([id,label])=>`<button type="button" class="choice ${value===id?'selected':''}" data-choice="${escapeHtml(key)}" data-value="${escapeHtml(id)}" aria-pressed="${value===id}" ${disabled?'disabled':''}>${escapeHtml(label)}</button>`).join('')}</div>`;
}
export function icon(name) {
  const paths={tasks:'M8 4h8v4H8z M5 6H3v15h18V6h-2 M7 12h10 M7 16h7',quality:'m8 12 3 3 5-6 M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6z',evaluation:'M4 20V9h4v11 M10 20V4h4v16 M16 20v-8h4v8',json:'m8 4-4 8 4 8 M16 4l4 8-4 8 M14 2l-4 20',project:'M3 7h18v14H3z M7 7V3h10v4 M3 12h18',guide:'M4 3h13l3 3v15H4z M8 8h8 M8 12h8 M8 16h5',sun:'M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',play:'m8 4 12 8-12 8z',pause:'M7 4v16 M17 4v16',back:'m14 5-7 7 7 7 M7 12h14',next:'m10 5 7 7-7 7',save:'M4 3h13l3 3v15H4z M8 3v6h8V3 M8 21v-7h8v7',download:'M12 3v12 m-5-5 5 5 5-5 M4 17v4h16v-4',undo:'m9 5-5 5 5 5 M4 10h10a6 6 0 0 1 0 12',redo:'m15 5 5 5-5 5 M20 10H10a6 6 0 0 0 0 12',split:'M12 3v18 M3 7l6 5-6 5 M21 7l-6 5 6 5',merge:'m3 7 6 5-6 5 M9 12h6 M21 7l-6 5 6 5',box:'M3 3h18v18H3z M7 3v18 M3 7h18',zoom:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6 M6 10h8 M10 6v8',check:'m4 12 5 5 11-11',close:'m5 5 14 14 M19 5 5 19',import:'M12 15V3 m-5 5 5-5 5 5 M4 15v6h16v-6',loop:'m17 2 4 4-4 4 M3 11V6h18 M7 22l-4-4 4-4 M21 13v5H3'};
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.tasks}"/></svg>`;
}
export const emptyState=(title,detail)=>`<div class="empty-state"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p></div>`;
