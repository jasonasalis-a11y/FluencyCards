const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*"}});
const now=()=>new Date().toISOString();

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(request.method==="OPTIONS")return new Response(null,{headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}});
    try{
      if(!env.DB)throw new Error("Missing D1 binding: DB");
      if(!env.ASSETS)throw new Error("Missing R2 binding: ASSETS");

      if(url.pathname==="/api/health")return json({ok:true,service:"fluency-engine-public-api",version:"0.9.4.1",storage:"r2",pwa:true});

      if(url.pathname==="/api/catalog" && request.method==="GET"){
        const rows=await env.DB.prepare(`SELECT c.course_id,c.title_en,c.title_kh,c.current_version_id,v.version_label,v.r2_object_key,v.content_sha256,v.byte_size FROM courses c LEFT JOIN course_versions v ON v.version_id=c.current_version_id WHERE c.published=1 ORDER BY c.course_id`).all();
        return json({courses:rows.results.map(x=>({...x,download_url:`/api/course/${encodeURIComponent(x.course_id)}`}))});
      }

      if(url.pathname.startsWith("/api/course/") && request.method==="GET"){
        const courseId=decodeURIComponent(url.pathname.slice("/api/course/".length));
        const row=await env.DB.prepare(`SELECT v.r2_object_key,v.content_sha256 FROM courses c JOIN course_versions v ON v.version_id=c.current_version_id WHERE c.course_id=? AND c.published=1`).bind(courseId).first();
        if(!row)return json({error:"Course not found"},404);
        const object=await env.ASSETS.get(row.r2_object_key);
        if(!object)return json({error:"Course object missing from R2"},500);
        const headers=new Headers();
        object.writeHttpMetadata(headers);
        headers.set("Content-Type","application/json; charset=utf-8");
        headers.set("Access-Control-Allow-Origin","*");
        headers.set("Cache-Control","public, max-age=300, s-maxage=3600");
        if(row.content_sha256)headers.set("ETag",`\"${row.content_sha256}\"`);
        return new Response(object.body,{headers});
      }

      if(url.pathname==="/api/analytics/batch" && request.method==="POST"){
        const body=await request.json();const events=Array.isArray(body.events)?body.events.slice(0,500):[];
        for(const e of events){
          await env.DB.prepare(`INSERT OR IGNORE INTO analytics_events (event_id,installation_id,event_type,course_id,lesson_id,card_index,payload_json,created_at,app_version) VALUES(?,?,?,?,?,?,?,?,?)`).bind(e.id,e.installation_id,e.type,e.course_id||"",e.lesson_id||"",Number.isInteger(e.card_index)?e.card_index:null,JSON.stringify(e),e.created_at||now(),e.app_version||"").run();
        }
        return json({accepted:events.length});
      }
      if(env.STATIC)return env.STATIC.fetch(request);
      return json({error:"Not found"},404);
    }catch(e){return json({error:e.message||String(e)},500)}
  }
};
