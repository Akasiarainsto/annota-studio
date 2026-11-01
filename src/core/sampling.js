export function stratifiedSample(tasks, options) {
  const {seed,rate}=options;const groups=new Map();
  let state=[...String(seed)].reduce((hash,char)=>Math.imul(hash^char.charCodeAt(0),16777619)>>>0,2166136261)||1;
  const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
  for (const task of tasks) {
    const key=`${task.modality} / ${task.difficulty} / ${task.assignee}`;
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push({id:task.id,version:task.version,round:task.round});
  }
  const strata=[...groups].map(([key,population])=>{
    const pool=[...population].sort((a,b)=>a.id.localeCompare(b.id));
    for (let index=pool.length-1;index>0;index--) {const other=Math.floor(random()*(index+1));[pool[index],pool[other]]=[pool[other],pool[index]];}
    return {key,population,selected:pool.slice(0,Math.ceil(pool.length*rate))};
  });
  return {seed:String(seed),rate,createdAt:new Date().toISOString(),rule:'modality-difficulty-assignee-v1',populationSize:tasks.length,strata,selectedIds:strata.flatMap(stratum=>stratum.selected.map(task=>task.id))};
}
