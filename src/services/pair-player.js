const DRIFT_LIMIT_S=.08;
export function mountPairPlayer(root,onError) {
  const players=[...root.querySelectorAll('[data-candidate]')];
  const state={playing:false,buffering:false,frame:0,mode:'common',operation:0};
  const duration=()=>players.every(player=>Number.isFinite(player.duration))?Math.min(...players.map(player=>player.duration)):0;
  function pause(){state.operation++;state.playing=false;state.buffering=false;players.forEach(player=>player.pause());render();}
  function render(){const ready=duration()>0;root.querySelector('#pair-play').disabled=!ready||state.mode!=='common';root.querySelector('#pair-play').textContent=state.playing?'同步暂停':'同步播放';root.querySelector('#pair-seek').max=duration();root.querySelector('#pair-seek').value=players[0].currentTime;root.querySelector('#pair-seek').disabled=state.mode!=='common';root.querySelector('#pair-time').textContent=`${players[0].currentTime.toFixed(3)} / ${duration().toFixed(3)} 秒`;root.querySelector('#pair-status').textContent=state.mode==='full'?'各自全片模式：使用两侧播放器分别检查尾部。':state.buffering?'任一侧缓冲，两侧已暂停，等待共同恢复。':`共同区间 0–${duration().toFixed(3)} 秒 · 到结尾同时停止`;
  }
  async function play(){if(!duration())return;const operation=++state.operation;state.playing=true;state.buffering=false;const time=players[0].currentTime>=duration()-.03?0:players[0].currentTime;players.forEach(player=>{if(Math.abs(player.currentTime-time)>DRIFT_LIMIT_S)player.currentTime=time;});const results=await Promise.allSettled(players.map(player=>player.play()));if(operation!==state.operation)return;if(results.some(result=>result.status==='rejected')){pause();throw new Error('两侧未能一起启动，已暂停，请再点击同步播放');}render();}
  async function seek(value){const resume=state.playing;pause();players.forEach(player=>{player.currentTime=Math.max(0,Math.min(duration(),value));});if(resume)await play();render();}
  for(const player of players){player.addEventListener('loadeddata',render);player.addEventListener('error',()=>{pause();onError(new Error('对比视频无法加载或解码'));});player.addEventListener('waiting',()=>{if(state.playing&&state.mode==='common'){state.operation++;state.buffering=true;players.forEach(item=>item.pause());render();}});player.addEventListener('canplay',async()=>{if(state.buffering&&players.every(item=>item.readyState>=3))try{await play();}catch(error){onError(error);}});}
  root.querySelector('#pair-play').addEventListener('click',async()=>{try{if(state.playing)pause();else await play();}catch(error){onError(error);}});
  root.querySelector('#pair-restart').addEventListener('click',async()=>{try{pause();players.forEach(player=>{player.currentTime=0;});if(state.mode==='common')await play();}catch(error){onError(error);}});
  root.querySelector('#pair-seek').addEventListener('input',async event=>{try{await seek(Number(event.target.value));}catch(error){onError(error);}});
  root.querySelector('#pair-speed').addEventListener('change',event=>players.forEach(player=>{player.playbackRate=Number(event.target.value);}));
  root.querySelector('#pair-audio').addEventListener('change',event=>players.forEach((player,index)=>{player.muted=event.target.value!==String(index);}));
  root.querySelector('#pair-mode').addEventListener('change',event=>{pause();state.mode=event.target.value;players.forEach(player=>{player.controls=state.mode==='full';});render();});
  function tick(){if(state.playing&&!state.buffering&&state.mode==='common'){const [left,right]=players;if(left.currentTime>=duration()-.025||left.ended||right.ended){pause();players.forEach(player=>{player.currentTime=duration();});}else if(!left.seeking&&!right.seeking&&Math.abs(left.currentTime-right.currentTime)>DRIFT_LIMIT_S)right.currentTime=left.currentTime;}render();state.frame=requestAnimationFrame(tick);}
  players[1].muted=true;tick();
  return {destroy:async()=>{cancelAnimationFrame(state.frame);pause();}};
}
