export function createHistory() {
  const past=[],future=[];
  return {
    get canUndo(){return past.length>0;},
    get canRedo(){return future.length>0;},
    push:document=>{past.push(structuredClone(document));if(past.length>50)past.shift();future.length=0;},
    undo:document=>{if(!past.length)return null;future.push(structuredClone(document));return past.pop();},
    redo:document=>{if(!future.length)return null;past.push(structuredClone(document));return future.pop();}
  };
}
