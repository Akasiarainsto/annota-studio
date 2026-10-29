import pg from 'pg';
import {attachDatabasePool} from '@neon/functions';

const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:5,ssl:{rejectUnauthorized:true}});
attachDatabasePool(pool);
export async function query(sql,parameters=[]) {return (await pool.query(sql,parameters)).rows;}
export async function transaction(operation) {
  const client=await pool.connect();
  try {await client.query('BEGIN');const result=await operation(client);await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK');throw error;}
  finally {client.release();}
}
export async function selectRows(client,sql,parameters=[]) {return (await client.query(sql,parameters)).rows;}
