const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*",...extra}});
const now=()=>new Date().toISOString();

export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==="OPTIONS")return new Response(null,{headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type,Authorization","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}});
  try{
   if(url.pathname==="/api/health")return json({ok:true,version:"0.9.1"});
   if(url.pathname==="/api/catalog"&&request.method==="GET"){
    const rows=await env.DB.prepare("SELECT course_id,title_en,title_kh,current_version_id FROM courses WHERE published=1 ORDER BY course_id").all();
    return json({courses:rows.results});
   }
   if(url.pathname==="/api/analytics/batch"&&request.method==="POST"){
    const {events=[]}=await request.json();
    for(const e of events.slice(0,500)){
      await env.DB.prepare("INSERT OR IGNORE INTO analytics_events(event_id,installation_id,event_type,course_id,lesson_id,card_index,payload_json,created_at,app_version) VALUES(?,?,?,?,?,?,?,?,?)")
      .bind(e.id,e.installation_id,e.type,e.course_id||"",e.lesson_id||"",Number.isInteger(e.card_index)?e.card_index:null,JSON.stringify(e),e.created_at||now(),e.app_version||"").run();
    }
    return json({accepted:Math.min(events.length,500)});
   }
   if(url.pathname==="/api/admin/summary"&&request.method==="GET"){
    requireAdmin(request,env);
    const a=await env.DB.prepare("SELECT COUNT(*) n FROM courses").first();
    const b=await env.DB.prepare("SELECT COUNT(*) n FROM course_versions").first();
    const c=await env.DB.prepare("SELECT COUNT(DISTINCT installation_id) n FROM analytics_events").first();
    const d=await env.DB.prepare("SELECT COUNT(*) n FROM analytics_events WHERE created_at>=datetime('now','-30 days')").first();
    return json({courses:a.n,course_versions:b.n,installations:c.n,events_30d:d.n});
   }
   if(url.pathname==="/api/admin/course/validate"&&request.method==="POST"){
    requireAdmin(request,env);const {course}=await request.json();const errors=validateCourse(course);return json({valid:errors.length===0,errors,lesson_count:course?.lessons?.length||0});
   }
   if(url.pathname==="/api/admin/course/import"&&request.method==="POST"){
    requireAdmin(request,env);const {course}=await request.json();const errors=validateCourse(course);if(errors.length)return json({error:"Validation failed",errors},400);
    const versionId=crypto.randomUUID(),courseId=course.course_id;
    await env.DB.prepare("INSERT INTO courses(course_id,title_en,title_kh,published,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(course_id) DO UPDATE SET title_en=excluded.title_en,title_kh=excluded.title_kh,updated_at=excluded.updated_at")
    .bind(courseId,course.title?.en||"",course.title?.kh||"",0,now(),now()).run();
    await env.DB.prepare("INSERT INTO course_versions(version_id,course_id,version_label,status,course_json,created_at) VALUES(?,?,?,?,?,?)")
    .bind(versionId,courseId,course.version||"draft","draft",JSON.stringify(course),now()).run();
    return json({ok:true,version_id:versionId});
   }
   if(url.pathname==="/api/admin/review"&&request.method==="POST"){
    requireAdmin(request,env);const body=await request.json();
    const row=await env.DB.prepare("SELECT course_json FROM course_versions WHERE version_id=?").bind(body.version_id).first();
    if(!row)return json({error:"Unknown course version"},404);
    const reviewId=crypto.randomUUID();
    const suggestions=await callProvider(env,body.provider,body.model,body.focus,JSON.parse(row.course_json));
    await env.DB.prepare("INSERT INTO review_runs(review_id,version_id,provider,model,focus,result_json,status,created_at) VALUES(?,?,?,?,?,?,?,?)")
    .bind(reviewId,body.version_id,body.provider,body.model,body.focus,JSON.stringify(suggestions),"complete",now()).run();
    return json({review_id:reviewId,result:suggestions});
   }
   if(url.pathname==="/api/admin/analytics/overview"&&request.method==="GET"){
    requireAdmin(request,env);
    const active=await env.DB.prepare("SELECT COUNT(DISTINCT installation_id) n FROM analytics_events WHERE created_at>=datetime('now','-7 days')").first();
    const opens=await env.DB.prepare("SELECT COUNT(*) n FROM analytics_events WHERE event_type='lesson_opened' AND created_at>=datetime('now','-7 days')").first();
    const plays=await env.DB.prepare("SELECT COUNT(*) n FROM analytics_events WHERE event_type='audio_played' AND created_at>=datetime('now','-7 days')").first();
    const downs=await env.DB.prepare("SELECT COUNT(*) n FROM analytics_events WHERE event_type='offline_download_completed' AND created_at>=datetime('now','-7 days')").first();
    const top=await env.DB.prepare("SELECT lesson_id,COUNT(*) opens FROM analytics_events WHERE event_type='lesson_opened' GROUP BY lesson_id ORDER BY opens DESC LIMIT 20").all();
    return json({active_installations_7d:active.n,lesson_opens_7d:opens.n,audio_plays_7d:plays.n,offline_downloads_7d:downs.n,top_lessons:top.results});
   }
   return json({error:"Not found"},404);
  }catch(e){return json({error:e.message||String(e)},500)}
 }
};

function requireAdmin(request,env){
 const email=request.headers.get("Cf-Access-Authenticated-User-Email")||"";
 if(env.ADMIN_EMAIL&&email.toLowerCase()!==env.ADMIN_EMAIL.toLowerCase())throw new Error("Admin access denied.");
}
function validateCourse(c){
 const e=[];if(!c||typeof c!=="object")return["Course must be a JSON object."];
 if(!c.course_id)e.push("course_id is required.");if(!c.title?.en)e.push("title.en is required.");if(!Array.isArray(c.lessons)||!c.lessons.length)e.push("lessons must be a non-empty array.");
 const ids=new Set();for(const l of c.lessons||[]){if(!l.id)e.push("Each lesson needs an id.");if(ids.has(l.id))e.push("Duplicate lesson id: "+l.id);ids.add(l.id);if(!Array.isArray(l.cards))e.push(`${l.id||"lesson"}: cards must be an array.`)}
 return e;
}
async function callProvider(env,provider,model,focus,course){
 const prompt=`${focus}\n\nCourse JSON:\n${JSON.stringify(course)}\n\nReturn JSON only with summary, suggestions[], and warnings[]. Never apply changes automatically.`;
 let endpoint,headers={},payload;
 if(provider==="openrouter"){endpoint="https://openrouter.ai/api/v1/chat/completions";headers.Authorization=`Bearer ${env.OPENROUTER_API_KEY}`;payload={model,messages:[{role:"user",content:prompt}],temperature:0.2}}
 else if(provider==="google"){endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GOOGLE_API_KEY}`;payload={contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.2,responseMimeType:"application/json"}}}
 else {endpoint="https://api.openai.com/v1/chat/completions";headers.Authorization=`Bearer ${env.OPENAI_API_KEY}`;payload={model,messages:[{role:"user",content:prompt}],temperature:0.2}}
 const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify(payload)});
 if(!r.ok)throw new Error(`AI provider returned ${r.status}: ${(await r.text()).slice(0,500)}`);
 const d=await r.json();const t=provider==="google"?d.candidates[0].content.parts[0].text:d.choices[0].message.content;
 return JSON.parse(t.replace(/^```json\s*/,"").replace(/\s*```$/,""));
}