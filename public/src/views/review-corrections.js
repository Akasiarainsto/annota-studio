import {showDialog} from './dialogs.js';
import {escapeHtml} from './shared.js';
import {post} from '../services/api.js';

const CORRECTION_MODES={
  withdraw:{title:'撤回我的复核意见',endpoint:'withdraw_review',button:'确认撤回，重新填写',hint:'另一位尚未提交，你可以撤回自己的意见。原结论和撤回原因将保留，撤回后可重新复核。'},
  request:{title:'申请更正复核结论',endpoint:'request_correction',button:'提交更正申请',hint:'本轮已有双人结果。提交申请后暂停沿用该结果，由独立负责人决定重新复核或驳回申请，原意见保留。'},
  resolve:{title:'处理复核更正申请',endpoint:'resolve_correction',button:'确认处理',hint:'重新发起后，同一份冻结标注进入新一轮，两位复核员需重新提交；原轮次不会删除。'}
};
export function openReviewCorrection(context,mode) {
  const {root,task,onComplete,onError}=context;const config=CORRECTION_MODES[mode];
  const request=(task.correctionRequests||[]).findLast(item=>item.status==='pending'&&item.round===task.round);
  const previous=mode==='resolve'?`<div class="reference-text"><b>${escapeHtml(request?.name)} · 第 ${task.round} 轮</b><p>${escapeHtml(request?.reason)}</p></div>`:`<p>你原来提交的结论：<b>${task.ownReview?.decision==='pass'?'合格':'不合格'}</b> · 第 ${task.round} 轮</p>`;
  const choices=mode==='resolve'?'<label>处理方式<select name="decision"><option value="reopen">重新发起双人复核</option><option value="reject">驳回申请，保留原结论</option></select></label>':'';
  const dialog=showDialog(root,config.title,`<p>${config.hint}</p>${previous}<form id="correction-form">${choices}<label>${mode==='resolve'?'处理依据':'更正 / 撤回原因'}<textarea name="reason" rows="3" required placeholder="说明哪项结论有误，以及为什么需要更正"></textarea></label><p id="correction-error" class="error-text" role="alert"></p><button type="submit" class="primary">${config.button}</button></form>`);
  dialog.querySelector('form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.target;const button=form.querySelector('button[type=submit]');button.disabled=true;
    try{const fields=new FormData(form);await post(`/tasks/${task.id}/${config.endpoint}`,{version:task.version,reason:fields.get('reason'),decision:fields.get('decision')});dialog.close();await onComplete(mode);}catch(error){dialog.querySelector('#correction-error').textContent=error.message;}finally{button.disabled=false;}
  });
}
