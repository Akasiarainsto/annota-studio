import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {requireCondition,getCookie} from './http.js';

const SESSION_MILLISECONDS=12*60*60*1000;
const hashToken=token=>createHash('sha256').update(token).digest('hex');
export const DEMO_ACCOUNTS=[
  {id:'annotator',name:'标注员',role:'annotator'},
  {id:'reviewer_a',name:'复核员甲',role:'reviewer'},
  {id:'reviewer_b',name:'复核员乙',role:'reviewer'},
  {id:'manager',name:'仲裁与项目负责人',role:'manager'}
];
export function seedAccounts(store) {
  for (const account of DEMO_ACCOUNTS) {
    if (store.getUser(account.id)) continue;
    const salt=randomBytes(16).toString('hex');
    store.addUser({...account,salt,password_hash:scryptSync('demo1234',salt,32).toString('hex')});
  }
}
export function createAccounts(store) {
  const current=request=>{
    const token=getCookie(request);const session=token?store.getSession(hashToken(token)):null;
    if (!session||session.expires_ms<Date.now()) return null;
    const user=store.getUser(session.user_id);
    return user?{id:user.id,name:user.name,role:user.role}:null;
  };
  return {
    current,
    requireUser:request=>{const user=current(request);requireCondition(user,401,'请登录本地工作区');return user;},
    login:credentials=>{
      const user=store.getUser(credentials.username);
      const candidate=scryptSync(String(credentials.password||''),user?.salt||'invalid-local-account',32);
      requireCondition(user&&timingSafeEqual(candidate,Buffer.from(user.password_hash,'hex')),401,'账号或密码不正确');
      const token=randomBytes(32).toString('base64url');
      store.addSession({hash:hashToken(token),userId:user.id,expires:Date.now()+SESSION_MILLISECONDS});
      return {user:{id:user.id,name:user.name,role:user.role},cookie:`annota_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`};
    },
    logout:request=>store.deleteSession(hashToken(getCookie(request)))
  };
}
