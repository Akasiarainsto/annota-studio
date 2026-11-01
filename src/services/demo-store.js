export const DEMO_USERS=[
  {id:'annotator',name:'标注员',role:'annotator'},
  {id:'reviewer_a',name:'复核员甲',role:'reviewer'},
  {id:'reviewer_b',name:'复核员乙',role:'reviewer'},
  {id:'manager',name:'仲裁与项目负责人',role:'manager'}
];
export function createDemoStore(workspace) {
  const copy=value=>value===undefined?null:structuredClone(value);
  return {
    listUsers:()=>copy(DEMO_USERS),
    listTasks:()=>Object.values(workspace.tasks).map(copy),
    getTask:id=>copy(workspace.tasks[id]),
    addTask:task=>{if(!workspace.tasks[task.id])workspace.tasks[task.id]=copy(task);},
    saveTask:(task,expected)=>{if(workspace.tasks[task.id]?.version!==expected)return false;workspace.tasks[task.id]=copy(task);return true;},
    getTimer:id=>copy(workspace.timers[id]),
    saveTimer:(id,timer)=>{workspace.timers[id]=copy(timer);},
    listTimers:()=>Object.entries(workspace.timers).map(([userId,timer])=>({userId,...copy(timer)})),
    getEvaluation:(userId,pairId)=>copy(workspace.evaluations[userId+':'+pairId]),
    saveEvaluation:(userId,pairId,evaluation)=>{workspace.evaluations[userId+':'+pairId]=copy(evaluation);}
  };
}
