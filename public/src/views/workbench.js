import {escapeHtml,icon,badge,MODALITY} from './shared.js';
export function renderWorkbench(task, reviewMode=false) {
  return `<section class="workbench"><div class="task-heading"><div class="task-title"><button id="back-to-tasks" class="small">${icon('back')} ${reviewMode?'质检队列':'我的任务'}</button><h1>${escapeHtml(task.label)}</h1>${badge(task.status)}<span class="badge neutral">${task.source?.name==='用户本地导入'?'本地素材':'教学示例'}</span></div><div class="task-links"><button id="task-history" class="small">修改与复核记录</button><button id="task-reference" class="small">规范与参考</button><button id="task-drawer" class="small">任务列表</button></div></div><div class="task-objective">${escapeHtml(task.objective)}<span class="muted">${MODALITY[task.modality]} · v${task.version}${task.round?' · 第 '+task.round+' 轮':''}${task.canEdit?'':' · 只读'}</span></div><div id="task-notice"></div><div id="editor-host" class="editor-host"></div><div id="checks-panel" class="checks-panel"></div></section>`;
}
export function renderActionbar(task) {
  const pending=task.status==='pending';
  const hint=task.status==='correction_pending'?'更正申请待处理，原结论保留，当前不可继续标注':task.canEdit?'草稿可保存；人工确认后提交质检':pending?`已收到 ${task.reviewCount}/2 份意见 · 另一位意见在本轮结束前封存`:'提交版本只读，修改需经过退回流程';
  return `<div><button id="previous-task">${icon('back')} 上一条</button><button id="next-task">下一条 ${icon('next')}</button></div><span class="action-hint">${hint}</span><div><button id="export-task">${icon('download')} 导出 JSON</button>${renderTaskActions(task)}</div>`;
}
function renderTaskActions(task) {
  if(task.canEdit)return `<button id="save-task">${icon('save')} 保存草稿</button><button id="submit-task" class="primary">${task.status==='returned'?'重新提交质检':'提交质检'}</button>`;
  const actions=[['canReview','open-review','填写独立复核'],['canArbitrate','open-arbitration','处理分歧'],['canWithdrawReview','withdraw-review','撤回复核并修改'],['canRequestCorrection','request-review-correction','申请更正复核结论'],['canHandleCorrection','handle-review-correction','处理复核更正']];
  const visible=actions.filter(([permission])=>task[permission]);
  return visible.length?visible.map(([,id,label])=>`<button id="${id}" class="primary">${label}</button>`).join(''):'<span class="badge neutral">只读结果</span>';
}
export function renderChecks(issues) {
  return `<button class="checks-summary" id="toggle-checks"><span class="${issues.length?'error-text':'success-text'}">${issues.length?'● '+issues.length+' 项待处理':'✓ 结构检查通过'}</span><span class="muted">内容仍需人工复核</span><span class="push-right">展开 / 收起</span></button><div id="checks-list" ${issues.length?'':'hidden'}>${issues.map(error=>`<button class="check-row" data-error-path="${escapeHtml(error.path)}"><code>${escapeHtml(error.code)}</code><span>${escapeHtml(error.message)}</span><span class="muted">${escapeHtml(error.path)} →</span></button>`).join('')}</div>`;
}
