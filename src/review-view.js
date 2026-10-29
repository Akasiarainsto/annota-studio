import {escapeHtml as esc} from './utils.js';
import {getCurrentReviews,REVIEW_LABELS} from './review-workflow.js';

function renderReviewHistory(task) {
  if(!task.reviews.length)return '<small class="muted">尚无审核记录</small>';
  return task.reviews.slice().reverse().map(review=>`<article class="review_entry"><strong>${esc(REVIEW_LABELS[review.decision]||'历史复核')} · ${esc(review.reviewer||'旧版未记录姓名')}</strong><small>${review.round?`第 ${review.round} 轮`:'旧版单次复核记录'} · r${review.revision} · ${esc(review.at)}</small><p>${esc(review.note)}</p></article>`).join('');
}
export function renderReviewSection(task) {
  const current=getCurrentReviews(task);const first=current.find(review=>review.decision==='opinion');
  const active=['pending','disputed'].includes(task.status);const arbitration=task.status==='disputed';
  const complete=task.status==='approved'&&current.some(review=>['approved','arbitrated'].includes(review.decision));
  const progress=complete?'本轮已完成':task.status==='approved'?'旧版验收 · 未执行本轮双人复核':task.status==='returned'?'本轮已退回 · 修改后重新提交':task.status==='draft'?'请先完成标注并提交复核':arbitration?'存在分歧 · 等待仲裁':first?'1 / 2 · 等待另一位复核人':'0 / 2 · 等待首轮意见';
  const label=arbitration?'仲裁通过':first?'第二人确认验收':'记录首轮通过意见';
  return `<div class="form_section"><h3>双人复核 <span class="pill">第 ${task.reviewRound||0} 轮</span></h3><div class="review_progress" id="review-progress">${progress}${first?`<small>首位复核人：${esc(first.reviewer)}</small>`:''}</div><div class="check_list">${['描述或转写与素材一致','时间或区域准确，无遗漏','属性与标签符合任务规范'].map((text,index)=>`<label class="check_item"><input type="checkbox" data-review-check="${index}" ${!active?'disabled':''}> ${text}</label>`).join('')}</div><div class="field"><label for="reviewer">${arbitration?'仲裁人':'本次复核人'}</label><input id="reviewer" autocomplete="off" placeholder="填写姓名；第二位须与首位不同" ${!active?'disabled':''}></div><div class="field"><label for="review-note">${arbitration?'仲裁结论 / 退回理由':'独立意见 / 退回或分歧理由'} · 必填</label><textarea id="review-note" placeholder="指出具体片段、核对依据与处理建议。" ${!active?'disabled':''}></textarea></div><div class="review_actions"><button class="button danger" data-action="return" ${!active?'disabled':''}>退回修改</button><button class="button primary" data-action="approve" ${!active?'disabled':''}>${label}</button>${!arbitration?`<button class="button" data-action="dispute" ${!active?'disabled':''}>提交分歧</button>`:''}</div><div class="inline_notice" style="margin-top:15px">两名不同姓名分别填写意见后确认；分歧可交仲裁。修改标注后须重新提交。此处模拟本地流程，不验证真实身份或隔离意见。</div></div><div class="form_section"><h3>复核记录</h3>${renderReviewHistory(task)}</div>`;
}
