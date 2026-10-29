export const REVIEW_LABELS=Object.freeze({opinion:'首轮独立意见',approved:'第二人确认通过',returned:'退回修改',disputed:'提交分歧',arbitrated:'仲裁通过'});
const ACTIVE_STATUSES=new Set(['pending','disputed']);
const normalizeReviewer=name=>name.trim().normalize('NFKC').toLowerCase();
const hasText=value=>typeof value==='string'&&value.trim().length>0;
const rejectReview=message=>({ok:false,message});

export function getCurrentReviews(task) {
  if(!Number.isSafeInteger(task.reviewRound)||task.reviewRound<1)return [];
  return task.reviews.filter(review=>review.round===task.reviewRound&&review.revision===task.revision);
}
export function upgradeReviewTask(task) {
  return {...task,reviewRound:task.reviewRound??(ACTIVE_STATUSES.has(task.status)?1:0)};
}
export function startReview(task,at=new Date().toISOString()) {
  if(!['draft','returned'].includes(task.status))return rejectReview('当前任务已提交、已验收或待仲裁，不能重复提交。');
  return {ok:true,task:{...task,status:'pending',reviewRound:(task.reviewRound||0)+1,updatedAt:at}};
}
function resolveDecision(task,options) {
  if(!ACTIVE_STATUSES.has(task.status))return rejectReview('请先提交当前修订，再记录复核意见。');
  if(!['approved','returned','disputed'].includes(options.decision))return rejectReview('复核操作不合法。');
  if(options.decision==='disputed'&&task.status==='disputed')return rejectReview('当前分歧需仲裁通过或退回修改。');
  if(options.decision!=='approved')return {ok:true,decision:options.decision,status:options.decision};
  if(task.status==='disputed')return {ok:true,decision:'arbitrated',status:'approved'};
  const first=getCurrentReviews(task).find(review=>review.decision==='opinion');
  if(!first)return {ok:true,decision:'opinion',status:'pending'};
  if(normalizeReviewer(first.reviewer)===normalizeReviewer(options.reviewer))return rejectReview('第二次复核需填写不同的复核人，不能由同一姓名重复确认。');
  return {ok:true,decision:'approved',status:'approved'};
}
export function applyReviewDecision(task,options) {
  if(!hasText(options.reviewer)||!hasText(options.note))return rejectReview('复核 / 仲裁人和独立意见均必填。');
  if(options.decision==='approved'&&!options.checksConfirmed)return rejectReview('请逐项完成人工复核后再记录通过意见。');
  const outcome=resolveDecision(task,options);if(!outcome.ok)return outcome;
  const review={id:options.id,round:task.reviewRound,revision:task.revision,reviewer:options.reviewer.trim(),note:options.note.trim(),decision:outcome.decision,at:options.at};
  return {ok:true,task:{...task,status:outcome.status,reviews:[...task.reviews,review],updatedAt:options.at}};
}

/** Old records remain readable; only the new explicit rounds claim two-person approval. */
export function validateReviewState(task) {
  const issue=message=>[{field:'reviews',message}];
  if(task.reviewRound===undefined)return [];
  if(!Number.isSafeInteger(task.reviewRound)||task.reviewRound<0)return issue('复核周期须为非负整数。');
  if(ACTIVE_STATUSES.has(task.status)&&task.reviewRound<1)return issue('待质检或待仲裁任务须先开启复核周期。');
  if(!Array.isArray(task.reviews)||task.reviews.some(review=>!review||typeof review!=='object'))return issue('复核记录须为对象数组。');
  const rounds=new Map();
  for(const review of task.reviews.filter(review=>review.round!==undefined)) {
    if(!Number.isSafeInteger(review.round)||review.round<1||review.round>task.reviewRound||!Number.isSafeInteger(review.revision)||review.revision<0||review.revision>task.revision)return issue('复核周期或修订引用无效。');
    if(!hasText(review.reviewer)||!hasText(review.note)||!hasText(review.at)||!Object.hasOwn(REVIEW_LABELS,review.decision))return issue('复核姓名、意见、时间或决定缺失 / 不合法。');
    if(!rounds.has(review.round))rounds.set(review.round,[]);
    rounds.get(review.round).push(review);
  }
  for(const [round,reviews] of rounds) {
    const replay={status:'pending',reviewRound:round,revision:reviews[0].revision,reviews:[]};
    for(const review of reviews) {
      const decision=['opinion','arbitrated'].includes(review.decision)?'approved':review.decision;
      const outcome=resolveDecision(replay,{decision,reviewer:review.reviewer});
      if(review.revision!==replay.revision||!outcome.ok||outcome.decision!==review.decision)return issue('复核记录不符合双人确认 / 分歧仲裁流程。');
      replay.status=outcome.status;replay.reviews.push(review);
    }
    if(round===task.reviewRound&&task.status!=='draft'&&(task.revision!==replay.revision||task.status!==replay.status))return issue('当前任务状态与本轮复核结论不一致。');
  }
  if(task.reviewRound>0&&['approved','returned','disputed'].includes(task.status)&&!rounds.has(task.reviewRound))return issue('当前状态缺少本轮复核记录。');
  return [];
}
