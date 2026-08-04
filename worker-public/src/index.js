const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8",...CORS,...extra}});
const now=()=>new Date().toISOString();
export default {async fetch(request,env){
  const url=new URL(request.url);if(request.method==='OPTIONS')return new Response(null,{headers:CORS});
  try{
    if(!env.DB)throw new Error('Missing D1 binding: DB');if(!env.ASSETS)throw new Error('Missing R2 binding: ASSETS');
    if(url.pathname==='/api/health')return json({ok:true,service:'fluency-engine-public',version:'0.9.5-beta',storage:'r2',pwa:true});
    if(url.pathname==='/api/catalog'&&request.method==='GET')return catalog(env);
    if(url.pathname.startsWith('/api/course/')&&request.method==='GET')return course(url,env);
    if(url.pathname.startsWith('/media/')&&request.method==='GET')return media(url,env);
    if(url.pathname==='/api/analytics/batch'&&request.method==='POST')return analytics(request,env);
    if(env.STATIC)return env.STATIC.fetch(request);
    return json({error:'Not found'},404);
  }catch(e){return json({error:e.message||String(e)},500)}
}};
async function catalog(env){const r=await env.DB.prepare(`SELECT c.course_id,c.title_en,c.title_kh,c.current_version_id,v.version_label,v.content_sha256,v.byte_size FROM courses c LEFT JOIN course_versions v ON v.version_id=c.current_version_id WHERE c.published=1 ORDER BY c.course_id`).all();return json({courses:r.results.map(x=>({...x,download_url:`/api/course/${encodeURIComponent(x.course_id)}`}))},200,{'Cache-Control':'public, max-age=60'})}
async function course(url,env){const id=decodeURIComponent(url.pathname.slice('/api/course/'.length)),row=await env.DB.prepare(`SELECT v.r2_object_key,v.content_sha256 FROM courses c JOIN course_versions v ON v.version_id=c.current_version_id WHERE c.course_id=? AND c.published=1`).bind(id).first();if(!row)return json({error:'Course not found'},404);const obj=await env.ASSETS.get(row.r2_object_key);if(!obj)return json({error:'Course object missing from R2'},500);const h=new Headers(CORS);obj.writeHttpMetadata(h);h.set('Content-Type','application/json; charset=utf-8');h.set('Cache-Control','public,max-age=300,s-maxage=3600');if(row.content_sha256)h.set('ETag',`"${row.content_sha256}"`);return new Response(obj.body,{headers:h})}
async function media(url,env){const key=decodeURIComponent(url.pathname.slice('/media/'.length)).replace(/^\/+/, '');if(!key||key.includes('..'))return json({error:'Invalid media path'},400);const obj=await env.ASSETS.get(key);if(!obj)return json({error:'Media not found'},404);const h=new Headers(CORS);obj.writeHttpMetadata(h);h.set('Cache-Control','public,max-age=31536000,immutable');return new Response(obj.body,{headers:h})}
async function analytics(request,env){const body=await request.json(),events=Array.isArray(body.events)?body.events.slice(0,500):[];for(const e of events)await env.DB.prepare(`INSERT OR IGNORE INTO analytics_events(event_id,installation_id,event_type,course_id,lesson_id,card_index,payload_json,created_at,app_version) VALUES(?,?,?,?,?,?,?,?,?)`).bind(e.id,e.installation_id,e.type,e.course_id||'',e.lesson_id||'',Number.isInteger(e.card_index)?e.card_index:null,JSON.stringify(e),e.created_at||now(),e.app_version||'').run();return json({accepted:events.length})}
