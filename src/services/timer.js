import {RUNTIME_MODE} from '../runtime-config.js';
import {post} from './api.js';
import {clock} from '../views/shared.js';

export async function createTimerControls(options) {
  const {root,getTask,onError}=options;const state={timer:await post('/timer',{action:'stop'}),syncedAt:performance.now()};
  const button=root.querySelector('#timer-toggle'),display=root.querySelector('#timer-value');
  const sync=timer=>{state.timer=timer;state.syncedAt=performance.now();render();};
  function render(){const task=getTask();const running=state.timer.active&&state.timer.taskId===task?.id;const saved=state.timer.totals[task?.id]||0;display.textContent=clock((saved+(running?performance.now()-state.syncedAt:0))/1000);button.textContent=running?'暂停计时':'开始计时';button.disabled=!task?.canEdit;button.classList.toggle('selected',running);}
  async function stop(){if(state.timer.active)sync(await post('/timer',{action:'stop'}));}
  button.addEventListener('click',async()=>{try{if(state.timer.active)await stop();else{const task=getTask();if(!task?.canEdit)throw new Error('先打开一条可编辑任务');sync(await post('/timer',{action:'start',taskId:task.id}));}}catch(error){onError(error);}});
  const heartbeat=setInterval(async()=>{if(state.timer.active)try{sync(await post('/timer',{action:'heartbeat'}));}catch(error){state.timer.active=false;onError(error);}},20000);
  const tick=setInterval(render,250);
  const leave=()=>{if(state.timer.active){if(RUNTIME_MODE==='interview')post('/timer',{action:'stop'}).catch(onError);else navigator.sendBeacon('/api/timer',new Blob([JSON.stringify({action:'stop'})],{type:'application/json'}));state.timer.totals[state.timer.taskId]=(state.timer.totals[state.timer.taskId]||0)+Math.min(60000,performance.now()-state.syncedAt);state.timer.active=false;render();}};
  const hidden=async()=>{if(document.hidden)leave();else try{sync(await post('/timer',{action:'stop'}));}catch(error){onError(error);}};document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',leave);
  render();return {render,stop,destroy:async()=>{await stop();clearInterval(heartbeat);clearInterval(tick);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',leave);}};
}
