import {createAuthClient} from '../vendor/neon-auth.js';
import {TEAM_CONFIG} from './team-config.js';

const auth=createAuthClient(TEAM_CONFIG.authUrl);
const FORCE_FETCH={fetchOptions:{headers:{'X-Force-Fetch':'true'}}};
const tokenCache={token:null,expires:0};
export async function getTeamSession() {
  // SDK 0.7 shares its /token and /get-session cache; request each documented endpoint freshly.
  const result=await auth.getSession(FORCE_FETCH);
  if(result.error)throw new Error(result.error.message||'读取登录会话失败');return result.data;
}
export async function authenticateTeam({mode,email,password,name}) {
  const result=mode==='signup'?await auth.signUp.email({email,password,name}):await auth.signIn.email({email,password});
  if(result.error)throw new Error(result.error.message||'登录失败');tokenCache.token=null;return getTeamSession();
}
export async function signOutTeam() {await auth.signOut();tokenCache.token=null;tokenCache.expires=0;}
async function getBearerToken() {
  if(tokenCache.token&&tokenCache.expires>Date.now()+30000)return tokenCache.token;
  const result=await auth.token(FORCE_FETCH);if(result.error||!result.data?.token)throw new Error(result.error?.message||'请先登录');
  tokenCache.token=result.data.token;const payload=JSON.parse(atob(result.data.token.split('.')[1].replaceAll('-','+').replaceAll('_','/')));tokenCache.expires=payload.exp*1000;return tokenCache.token;
}
export async function teamRequest(path,options={}) {
  const token=await getBearerToken();const headers=new Headers(options.headers||{});headers.set('Authorization',`Bearer ${token}`);
  let body=options.body;if(body&&!(body instanceof Blob)&&!(body instanceof ArrayBuffer)&&!(body instanceof Uint8Array)){headers.set('Content-Type','application/json');body=JSON.stringify(body);}
  const response=await fetch(new URL(path,TEAM_CONFIG.apiUrl),{...options,headers,body});
  if(!response.ok){const result=await response.json();throw Object.assign(new Error(result.error||`服务请求失败 ${response.status}`),{status:response.status,issues:result.issues});}
  return options.blob?response.blob():response.json();
}
