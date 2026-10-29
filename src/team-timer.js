import {teamRequest} from './team-api.js';

export function createTeamTimer({taskId,workType='annotation',onUpdate=()=>{},onError=()=>{}}) {
  const state={active:false,interval:null,record:null};
  const request=action=>teamRequest(`tasks/${taskId}/session`,{method:'POST',body:{action,workType},keepalive:action==='stop'});
  async function start() {
    if(state.active)return;state.record=await request('start');state.active=true;onUpdate(state);
    state.interval=setInterval(async()=>{try{state.record=await request('heartbeat');onUpdate(state);}catch(error){clearInterval(state.interval);state.active=false;onUpdate(state);onError(error.message);}},20000);
  }
  async function stop() {
    clearInterval(state.interval);if(!state.active)return;state.active=false;
    try{state.record=await request('stop');onUpdate(state);}catch(error){onError(error.message);throw error;}
  }
  return {start,stop,get active(){return state.active;},destroy:stop};
}
