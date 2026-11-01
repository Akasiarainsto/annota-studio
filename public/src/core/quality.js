export const getActiveReviews = (task,round=task.round) => task.reviews.filter(review=>review.round===round&&!review.withdrawnAt);
export function getReviewCorrectionPermissions(task,user) {
  const current=getActiveReviews(task);
  const own=current.find(review=>review.reviewer===user.id);
  const frozen=task.rounds.find(round=>round.round===task.round);
  const unchanged=!!frozen&&JSON.stringify(frozen.document)===JSON.stringify(task.draft);
  return {
    canWithdrawReview:user.role==='reviewer'&&task.status==='pending'&&current.length===1&&!!own,
    canRequestCorrection:user.role==='reviewer'&&!!own&&['approved','returned','disputed'].includes(task.status)&&unchanged,
    canHandleCorrection:user.role==='manager'&&task.status==='correction_pending'&&task.assignee!==user.id&&!current.some(review=>review.reviewer===user.id)
  };
}
export function resolveReviewStatus(reviews) {
  if (reviews.length<2) return 'pending';
  if (reviews.every(review=>review.decision==='pass')) return 'approved';
  if (reviews.every(review=>review.decision==='fail')) return 'returned';
  return 'disputed';
}
export function calculateKappa(pairs) {
  const matrix = {pass_pass:0,pass_fail:0,fail_pass:0,fail_fail:0};
  pairs.forEach(([first,second])=>matrix[`${first}_${second}`]++);
  const n=pairs.length;
  if (!n) return {n,matrix,value:null,reason:'尚无完整的双人独立判断配对'};
  const po=(matrix.pass_pass+matrix.fail_fail)/n;
  const firstPass=(matrix.pass_pass+matrix.pass_fail)/n;
  const secondPass=(matrix.pass_pass+matrix.fail_pass)/n;
  const pe=firstPass*secondPass+(1-firstPass)*(1-secondPass);
  return {n,matrix,po,pe,value:pe===1?null:(po-pe)/(1-pe),reason:pe===1?'判断类别无变化，Pe=1，Kappa 不可计算':n<20?'小样本，仅用于查看一致性，不作质量门槛':''};
}
