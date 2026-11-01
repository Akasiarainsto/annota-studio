export const RUNTIME_MODE='interview';
export const APP_BASE=new URL('../',import.meta.url).pathname;
export const runtimeText=(local,interview)=>RUNTIME_MODE==='interview'?interview:local;
