import {clamp,formatTime} from './utils.js';

const DRIFT_TOLERANCE_SECONDS=0.08;
const END_TOLERANCE_SECONDS=0.02;
function getDuration(context) {
  return context.players.length===2&&context.players.every(player=>Number.isFinite(player.duration)&&player.duration>0)?Math.min(...context.players.map(player=>player.duration)):0;
}
function updateTransport(context) {
  const duration=getDuration(context);const ready=duration>0&&context.players.every(player=>player.readyState>=2)&&!context.failed;
  context.root.querySelectorAll('[data-pair-action],#pair-seek,#pair-speed').forEach(control=>control.disabled=!ready);
  const slider=context.root.querySelector('#pair-seek');slider.max=duration;slider.value=context.players[0]?.currentTime||0;
  context.root.querySelector('#pair-time').textContent=`${formatTime(context.players[0]?.currentTime||0)} / ${formatTime(duration)}`;
  context.root.querySelector('[data-pair-action="toggle"]').textContent=context.playing?'同步暂停':'同步播放';
  context.root.querySelector('#pair-status').textContent=context.failed?'视频加载失败，请检查两侧素材':context.buffering?'等待两侧缓冲…':ready?`统一进度 · 按较短视频 ${duration.toFixed(2)} 秒结束`:'正在加载两侧视频…';
}
function pausePair(context) {
  context.operation++;context.playing=false;context.buffering=false;
  context.players.forEach(player=>player.pause());updateTransport(context);
}
async function playPair(context) {
  if(context.failed||!getDuration(context)||context.abort.signal.aborted)return;
  const operation=++context.operation;context.buffering=false;context.playing=true;
  const first=context.players[0];const duration=getDuration(context);
  const time=first.currentTime>=duration-END_TOLERANCE_SECONDS?0:first.currentTime;
  context.players.forEach(player=>{if(Math.abs(player.currentTime-time)>DRIFT_TOLERANCE_SECONDS||time===0)player.currentTime=time;});
  updateTransport(context);
  const results=await Promise.allSettled(context.players.map(player=>player.play()));
  if(context.abort.signal.aborted){context.players.forEach(player=>player.pause());return;}
  if(operation!==context.operation)return;
  if(results.some(result=>result.status==='rejected')){pausePair(context);context.onError('两侧未能同时启动，已一起暂停；请重新点击同步播放。');}
}
function seekPair(context,time) {
  const duration=getDuration(context);if(!duration||!Number.isFinite(time))return;
  const resume=context.playing;const target=clamp(time,0,duration);pausePair(context);
  context.players.forEach(player=>{player.currentTime=target;});updateTransport(context);
  if(resume&&target<duration-END_TOLERANCE_SECONDS)void playPair(context);
}
function animatePair(context) {
  if(context.abort.signal.aborted)return;
  const [left,right]=context.players;const duration=getDuration(context);
  if(context.playing&&!context.buffering&&duration) {
    if(left.ended||right.ended||left.currentTime>=duration-END_TOLERANCE_SECONDS){pausePair(context);context.players.forEach(player=>{player.currentTime=duration;});}
    else if(!left.seeking&&!right.seeking&&Math.abs(left.currentTime-right.currentTime)>DRIFT_TOLERANCE_SECONDS)right.currentTime=left.currentTime;
  }
  updateTransport(context);context.frame=requestAnimationFrame(()=>animatePair(context));
}
function handleBuffering(context) {
  if(!context.playing||context.buffering)return;
  context.operation++;context.buffering=true;context.players.forEach(player=>player.pause());updateTransport(context);
}
function installPairEvents(context) {
  const options={signal:context.abort.signal};
  for(const player of context.players) {
    player.addEventListener('loadedmetadata',()=>updateTransport(context),options);
    player.addEventListener('loadeddata',()=>updateTransport(context),options);
    player.addEventListener('waiting',()=>handleBuffering(context),options);
    player.addEventListener('canplay',()=>{if(context.buffering&&context.players.every(item=>item.readyState>=3))void playPair(context);},options);
    player.addEventListener('error',()=>{context.failed=true;pausePair(context);context.onError('对比视频无法载入或解码，已暂停两侧播放。');},options);
  }
  context.root.addEventListener('click',event=>{
    const action=event.target.closest('[data-pair-action]')?.dataset.pairAction;
    if(action==='toggle'){if(context.playing)pausePair(context);else void playPair(context);}
    if(action==='restart'){pausePair(context);seekPair(context,0);void playPair(context);}
  },options);
  context.root.querySelector('#pair-seek').addEventListener('input',event=>seekPair(context,Number(event.target.value)),options);
  context.root.querySelector('#pair-speed').addEventListener('change',event=>context.players.forEach(player=>{player.playbackRate=Number(event.target.value);}),options);
}
export function mountVideoComparison(options) {
  const context={...options,players:[...options.root.querySelectorAll('[data-pair-video]')],abort:new AbortController(),operation:0,playing:false,buffering:false,failed:false,frame:0};
  installPairEvents(context);animatePair(context);
  return {destroy(){context.abort.abort();cancelAnimationFrame(context.frame);context.players.forEach(player=>player.pause());},playPause(){if(context.playing)pausePair(context);else void playPair(context);},seek:time=>seekPair(context,time),nudge:seconds=>seekPair(context,(context.players[0]?.currentTime||0)+seconds),get currentTime(){return context.players[0]?.currentTime||0;}};
}
