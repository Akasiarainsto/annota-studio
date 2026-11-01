import {validateDocument} from '../core/validation.js';
import {resolveReviewStatus,getActiveReviews,getReviewCorrectionPermissions} from '../core/quality.js';
import {hasText} from '../core/checks.js';
import {requireCondition} from '../core/require-condition.js';

function appendEvent(task,user,kind,note='') {
  task.events.push({actor:user.id,name:user.name,kind,note,at:new Date().toISOString(),round:task.round,version:task.version});
}
export function exposeTask(task,user) {
  const current=getActiveReviews(task);
  const visible=task.status!=='pending';
  return {...task,reviews:task.reviews.filter(review=>review.round<task.round||visible||review.reviewer===user.id),
    events:task.events.filter(event=>event.round<task.round||visible||!['review','review_withdrawn'].includes(event.kind)||event.actor===user.id),
    ...getReviewCorrectionPermissions(task,user),
    canEdit:user.id===task.assignee&&['draft','returned'].includes(task.status),
    canReview:user.role==='reviewer'&&user.id!==task.assignee&&task.status==='pending'&&!current.some(review=>review.reviewer===user.id),
    canArbitrate:user.role==='manager'&&task.status==='disputed'&&user.id!==task.assignee&&!current.some(review=>review.reviewer===user.id),
    ownReview:current.find(review=>review.reviewer===user.id)||null,
    reviewCount:current.length};
}
export function createTaskService(store) {
  const load=id=>{const task=store.getTask(id);requireCondition(task,404,'任务不存在');return task;};
  const persist=(task,user,kind)=>{
    const expected=task.version;task.version++;task.updatedAt=new Date().toISOString();appendEvent(task,user,kind);
    requireCondition(store.saveTask(task,expected),409,'任务版本已变化，请保留本地草稿后重新载入');return exposeTask(task,user);
  };
  const checkVersion=(task,body)=>requireCondition(body.version===task.version,409,'服务端版本已变化；当前草稿未覆盖，请重新载入后比较');
  return {
    list:user=>store.listTasks().map(task=>{const view=exposeTask(task,user);return {id:view.id,label:view.label,modality:view.modality,status:view.status,version:view.version,round:view.round,media:view.media,assignee:view.assignee,difficulty:view.difficulty,canEdit:view.canEdit,canReview:view.canReview,canArbitrate:view.canArbitrate,canHandleCorrection:view.canHandleCorrection,reviewCount:view.reviewCount};}),
    get:(id,user)=>exposeTask(load(id),user),
    save:(id,user,body)=>{
      const task=load(id);checkVersion(task,body);requireCondition(exposeTask(task,user).canEdit,403,'仅任务标注员能修改草稿；已提交版本只读');
      requireCondition(body.document?.task_id===id&&body.document?.modality===task.modality,400,'文档与任务不一致');
      requireCondition(body.document?.media&&Object.keys(task.media).every(key=>body.document.media[key]===task.media[key])&&Object.keys(body.document.media).length===Object.keys(task.media).length,400,'媒体信息须保持与原片一致');
      task.draft=body.document;return persist(task,user,'save');
    },
    submit:(id,user,body)=>{
      const task=load(id);checkVersion(task,body);requireCondition(exposeTask(task,user).canEdit,403,'当前账号或状态不能提交');
      const issues=validateDocument(task.draft,{submission:true,media:task.media});requireCondition(!issues.length,422,'请先修正检查结果',issues);
      task.round++;task.status='pending';task.rounds.push({round:task.round,document:structuredClone(task.draft),submittedAt:new Date().toISOString(),version:task.version});
      return persist(task,user,'submit');
    },
    review:(id,user,body)=>{
      const task=load(id);checkVersion(task,body);requireCondition(exposeTask(task,user).canReview,403,'需不同的独立复核账号；不能复核自己的任务或重复复核');
      requireCondition(['pass','fail'].includes(body.decision),400,'复核结论无效');
      requireCondition(Array.isArray(body.checks)&&body.checks.length===4&&body.checks.every(Boolean),400,'请完成四项人工复核清单');
      if (body.decision==='fail') {
        requireCondition(hasText(body.note)&&hasText(body.target),400,'不合格必须填写具体位置和理由');
        const ids=task.modality==='image'?['image',...task.draft.boxes.map(box=>box.id)]:task.draft.segments.map(segment=>segment.id);
        requireCondition(ids.includes(body.target),400,'问题位置须引用当前版本片段或区域');
      }
      task.reviews.push({reviewer:user.id,name:user.name,round:task.round,decision:body.decision,note:body.note||'',target:body.target||'',at:new Date().toISOString()});
      task.status=resolveReviewStatus(getActiveReviews(task));
      return persist(task,user,'review');
    },
    arbitrate:(id,user,body)=>{
      const task=load(id);checkVersion(task,body);requireCondition(exposeTask(task,user).canArbitrate,403,'只有未参与标注和复核的负责人能仲裁分歧');
      requireCondition(['pass','fail'].includes(body.decision)&&hasText(body.note),400,'请选择仲裁结果并填写依据');
      task.status=body.decision==='pass'?'approved':'returned';appendEvent(task,user,'arbitrate',body.note);
      return persist(task,user,'arbitration_finished');
    },
    withdraw_review:(id,user,body)=>{
      const task=load(id);checkVersion(task,body);
      requireCondition(getReviewCorrectionPermissions(task,user).canWithdrawReview,403,'只可撤回自己尚未形成双人结果的意见；已有双人结果请申请更正');
      requireCondition(hasText(body.reason),400,'请填写撤回原因');
      const review=getActiveReviews(task).find(item=>item.reviewer===user.id);
      review.withdrawnAt=new Date().toISOString();review.withdrawalReason=body.reason.trim();
      return persist(task,user,'review_withdrawn');
    },
    request_correction:(id,user,body)=>{
      const task=load(id);checkVersion(task,body);
      requireCondition(getReviewCorrectionPermissions(task,user).canRequestCorrection,403,'仅已提交本轮意见的复核员可申请更正；若标注已修订，请按重提流程继续');
      requireCondition(hasText(body.reason),400,'请填写原结论哪里有误及更正原因');
      const correction={round:task.round,requester:user.id,name:user.name,reason:body.reason.trim(),at:new Date().toISOString(),originalStatus:task.status,status:'pending'};
      task.correctionRequests=[...(task.correctionRequests||[]),correction];task.status='correction_pending';
      return persist(task,user,'review_correction_requested');
    },
    resolve_correction:(id,user,body)=>{
      const task=load(id);checkVersion(task,body);
      requireCondition(getReviewCorrectionPermissions(task,user).canHandleCorrection,403,'只有未参与本条标注或复核的负责人可处理更正');
      requireCondition(['reopen','reject'].includes(body.decision)&&hasText(body.reason),400,'请选择处理方式并填写依据');
      const correction=(task.correctionRequests||[]).findLast(item=>item.round===task.round&&item.status==='pending');
      requireCondition(correction,409,'更正申请已处理，请重新载入');
      Object.assign(correction,{status:body.decision==='reopen'?'reopened':'rejected',handler:user.id,handlerName:user.name,handledAt:new Date().toISOString(),handlerReason:body.reason.trim()});
      if(body.decision==='reject')task.status=correction.originalStatus;
      else {
        const previous=task.rounds.find(round=>round.round===task.round);
        previous.supersededBy=task.round+1;task.round++;task.status='pending';correction.nextRound=task.round;
        task.rounds.push({round:task.round,document:structuredClone(previous.document),submittedAt:new Date().toISOString(),version:task.version,reason:'review_correction',previousRound:previous.round});
      }
      return persist(task,user,body.decision==='reopen'?'review_reopened':'review_correction_rejected');
    }
  };
}
