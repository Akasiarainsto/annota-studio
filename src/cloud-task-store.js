export function createCloudTaskStore({initial,api,user}) {
  const state={version:initial.version,tasks:[initial.task],queue:[],running:false,conflict:false};
  async function drain() {
    if(state.running)return;state.running=true;
    try {
      while(state.queue.length){const job=state.queue.shift();try {
        const saved=await api(`tasks/${initial.task.id}`,{method:'PUT',body:{version:state.version,task:job.snapshot}});state.version=saved.version;
        if(JSON.stringify(state.tasks[0])===JSON.stringify(job.snapshot)){const url=state.tasks[0].media.url;Object.assign(state.tasks[0],saved.task);state.tasks[0].media.url=url;}
        job.resolve(saved);
      }catch(error){state.conflict=error.status===409;job.reject(error);for(const pending of state.queue.splice(0))pending.reject(error);}}
    }finally{state.running=false;}
  }
  function saveTasks(tasks) {
    if(state.conflict)return Promise.reject(new Error('云端版本冲突，当前修改仍在内存中；请导出当前标注后重新载入合并。'));
    return new Promise((resolve,reject)=>{state.queue.push({snapshot:structuredClone(tasks[0]),resolve,reject});void drain();});
  }
  async function submit() {
    if(state.running||state.queue.length)await saveTasks(state.tasks);
    const result=await api(`tasks/${initial.task.id}/submit`,{method:'POST',body:{version:state.version}});state.version=result.version;state.tasks[0].status=result.task.status;return result;
  }
  return {tasks:state.tasks,user,projectId:initial.projectId,canEdit:initial.canEdit,role:initial.role,saveTasks,submit,get pending(){return state.running||state.queue.length>0;}};
}
