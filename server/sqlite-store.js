import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';

export function createStore(filename) {
  mkdirSync(dirname(filename),{recursive:true});
  const database=new DatabaseSync(filename);
  database.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT,role TEXT,salt TEXT,password_hash TEXT);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_ms INTEGER);
    CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,version INTEGER NOT NULL,payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS timers(user_id TEXT PRIMARY KEY,payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS evaluations(user_id TEXT,pair_id TEXT,payload TEXT,PRIMARY KEY(user_id,pair_id));`);
  return {
    getUser:id=>database.prepare('SELECT * FROM users WHERE id=?').get(id),
    listUsers:()=>database.prepare('SELECT id,name,role FROM users').all(),
    addUser:user=>database.prepare('INSERT OR IGNORE INTO users VALUES(?,?,?,?,?)').run(user.id,user.name,user.role,user.salt,user.password_hash),
    addSession:session=>database.prepare('INSERT INTO sessions VALUES(?,?,?)').run(session.hash,session.userId,session.expires),
    getSession:hash=>database.prepare('SELECT * FROM sessions WHERE token_hash=?').get(hash),
    deleteSession:hash=>database.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash),
    listTasks:()=>database.prepare('SELECT payload FROM tasks ORDER BY id').all().map(row=>JSON.parse(row.payload)),
    getTask:id=>{const row=database.prepare('SELECT payload FROM tasks WHERE id=?').get(id);return row?JSON.parse(row.payload):null;},
    addTask:task=>database.prepare('INSERT OR IGNORE INTO tasks VALUES(?,?,?)').run(task.id,task.version,JSON.stringify(task)),
    saveTask:(task,expected)=>Number(database.prepare('UPDATE tasks SET payload=?,version=? WHERE id=? AND version=?').run(JSON.stringify(task),task.version,task.id,expected).changes)===1,
    getTimer:id=>{const row=database.prepare('SELECT payload FROM timers WHERE user_id=?').get(id);return row?JSON.parse(row.payload):null;},
    saveTimer:(id,timer)=>database.prepare('INSERT INTO timers VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload').run(id,JSON.stringify(timer)),
    listTimers:()=>database.prepare('SELECT user_id,payload FROM timers').all().map(row=>({userId:row.user_id,...JSON.parse(row.payload)})),
    getEvaluation:(userId,pairId)=>{const row=database.prepare('SELECT payload FROM evaluations WHERE user_id=? AND pair_id=?').get(userId,pairId);return row?JSON.parse(row.payload):null;},
    saveEvaluation:(userId,pairId,payload)=>database.prepare('INSERT INTO evaluations VALUES(?,?,?) ON CONFLICT(user_id,pair_id) DO UPDATE SET payload=excluded.payload').run(userId,pairId,JSON.stringify(payload)),
    close:()=>database.close()
  };
}
