import {createRemoteJWKSet,jwtVerify} from 'jose';
import {ensureUser} from './access.js';
import {routeRequest} from './routes.js';

const jwks=createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL));
function getCorsHeaders(request) {
  const origin=request.headers.get('origin');
  const allowed=!origin||origin==='https://akasiarainsto.github.io'||/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  return {allowed,headers:{'Access-Control-Allow-Origin':allowed&&origin?origin:'https://akasiarainsto.github.io','Access-Control-Allow-Headers':'Authorization,Content-Type,If-Match,Range','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,OPTIONS','Access-Control-Expose-Headers':'Content-Range,Content-Length','Vary':'Origin'}};
}
async function authenticate(request) {
  const authorization=request.headers.get('authorization')||'';
  if(!authorization.startsWith('Bearer '))throw Object.assign(new Error('请先登录'),{status:401});
  try {
    const {payload}=await jwtVerify(authorization.slice(7),jwks,{issuer:new URL(process.env.NEON_AUTH_BASE_URL).origin});
    if(!payload.sub)throw new Error('Missing subject');
    return {id:payload.sub,name:payload.name||'',email:payload.email||''};
  } catch {throw Object.assign(new Error('登录已过期，请重新登录'),{status:401});}
}
export default {
  async fetch(request) {
    const cors=getCorsHeaders(request);
    if(!cors.allowed)return Response.json({error:'来源域名未授权'},{status:403});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors.headers});
    if(new URL(request.url).pathname==='/health')return Response.json({ok:true,service:'annota-team',database:!!process.env.DATABASE_URL,auth:!!process.env.NEON_AUTH_JWKS_URL,storage:!!process.env.AWS_ENDPOINT_URL_S3},{headers:cors.headers});
    try {
      const identity=await authenticate(request);const user=await ensureUser(identity);
      const result=await routeRequest(request,user);const response=result instanceof Response?result:Response.json(result);
      for(const [key,value]of Object.entries(cors.headers))response.headers.set(key,value);
      response.headers.set('Cache-Control','private,no-store');return response;
    } catch(error) {
      const status=error.status||(['23505','40001','40P01'].includes(error.code)?409:['22P02','23514'].includes(error.code)?400:500);
      return Response.json({error:status===500?'服务暂时不可用，请稍后重试':error.message,issues:error.issues||undefined},{status,headers:cors.headers});
    }
  }
};
