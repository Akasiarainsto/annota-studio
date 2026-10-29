import {S3Client,PutObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3';
import {randomUUID} from 'node:crypto';
import {query} from './db.js';
import {requireMember} from './access.js';
import {requireCondition,requireText,readBytes} from './http.js';

const s3=new S3Client({forcePathStyle:true});
const MAX_MEDIA_BYTES=100*1024*1024;
const MEDIA_SUFFIXES=new Set(['wav','mp3','m4a','aac','flac','ogg','opus','aif','aiff','mp4','webm','mov','mkv','avi','png','jpg','jpeg','webp','bmp','gif']);
export async function uploadMedia(userId,options) {
  await requireMember(userId,options.projectId,{roles:['owner','manager','annotator']});
  const name=requireText(options.name,'文件名',200);requireCondition(MEDIA_SUFFIXES.has(name.split('.').at(-1).toLowerCase())&&!name.includes('\0'),400,'不支持此媒体扩展名');
  const bytes=await readBytes(options.request,MAX_MEDIA_BYTES);requireCondition(bytes.length>0,400,'文件为空');
  const key=`${options.projectId}/${randomUUID()}/${encodeURIComponent(name)}`;
  const mime=options.request.headers.get('content-type')||'application/octet-stream';
  await s3.send(new PutObjectCommand({Bucket:'media',Key:key,Body:bytes,ContentType:mime}));
  const [stored]=await query('INSERT INTO annota.media(project_id,object_key,name,mime,bytes,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,mime,bytes',[options.projectId,key,name,mime,bytes.length,userId]);return stored;
}
export async function readMedia(userId,options) {
  const [media]=await query('SELECT * FROM annota.media WHERE id=$1',[options.id]);requireCondition(media,404,'媒体不存在');await requireMember(userId,media.project_id);
  const result=await s3.send(new GetObjectCommand({Bucket:'media',Key:media.object_key,Range:options.range||undefined}));
  const headers={'Content-Type':media.mime,'Content-Length':String(result.ContentLength),'Accept-Ranges':'bytes','Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'};
  if(result.ContentRange)headers['Content-Range']=result.ContentRange;
  return new Response(result.Body.transformToWebStream(),{status:result.ContentRange?206:200,headers});
}
