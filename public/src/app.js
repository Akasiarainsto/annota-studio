import {request,post} from './services/api.js';
import {renderLogin} from './views/shell.js';
import {createWorkspace} from './workspace.js';
import {RUNTIME_MODE} from './runtime-config.js';
import {initializeDemoMedia} from './services/demo-api.js';
import {resetDemoWorkspace} from './services/demo-workspace.js';

async function startApp() {
  const root=document.querySelector('#app');
  document.documentElement.dataset.theme=localStorage.getItem('annota-local-theme')||'light';
  async function showLogin(){
    root.innerHTML=renderLogin();
    root.querySelector('#reset-demo')?.addEventListener('click',async()=>{if(!confirm('重置当前浏览器的演示任务、复核记录和导入素材？此操作不影响本地服务版或其他人的浏览器。'))return;try{await resetDemoWorkspace();root.querySelector('#login-error').textContent='演示已重置，可以从标注员重新开始。';}catch(error){root.querySelector('#login-error').textContent=error.message;}});
    root.querySelector('#login-form').addEventListener('submit',async event=>{
      event.preventDefault();const button=event.target.querySelector('button[type=submit]');button.disabled=true;
      try{const fields=new FormData(event.target);const {user}=await post('/login',{username:fields.get('username'),password:fields.get('password')});await createWorkspace({root,user,onLogout:showLogin});}
      catch(error){const errorNode=root.querySelector('#login-error');if(errorNode)errorNode.textContent=error.message;else root.innerHTML='<div class="empty-state">工作区载入失败，请刷新重试。</div>';}
      finally{if(button.isConnected)button.disabled=false;}
    });
  }
  try{if(RUNTIME_MODE==='interview')await initializeDemoMedia();const {user}=await request('/session');if(user)await createWorkspace({root,user,onLogout:showLogin});else await showLogin();}
  catch(error){root.innerHTML='<div class="empty-state"><h1>工作区暂时无法打开</h1><p></p><button onclick="location.reload()">重新打开</button></div>';root.querySelector('.empty-state p').textContent=error.message;}
}
await startApp();
