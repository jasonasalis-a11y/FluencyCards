const json=(data,status=200)=>new Response(JSON.stringify(data),{
  status,
  headers:{
    "Content-Type":"application/json; charset=utf-8",
    "Access-Control-Allow-Origin":"*"
  }
});

const now=()=>new Date().toISOString();
const textEncoder=new TextEncoder();

export default {
  async fetch(request,env){
    const url=new URL(request.url);

    if(request.method==="OPTIONS"){
      return new Response(null,{headers:{
        "Access-Control-Allow-Origin":"*",
        "Access-Control-Allow-Headers":"Content-Type,Authorization",
        "Access-Control-Allow-Methods":"GET,POST,OPTIONS"
      }});
    }

    try{
      requireAdmin(request,env);
      requireBindings(env);

      if(url.pathname==="/api/health"){
        return json({ok:true,service:"fluency-engine-admin-api",version:"0.9.4",storage:"r2"});
      }

      if(url.pathname==="/api/admin/summary" && request.method==="GET"){
        const a=await env.DB.prepare("SELECT COUNT(*) n FROM courses").first();
        const b=await env.DB.prepare("SELECT COUNT(*) n FROM course_versions").first();
        const c=await env.DB.prepare("SELECT COUNT(DISTINCT installation_id) n FROM analytics_events").first();
        const d=await env.DB.prepare(
          "SELECT COUNT(*) n FROM analytics_events WHERE created_at>=datetime('now','-30 days')"
        ).first();
        return json({courses:a.n,course_versions:b.n,installations:c.n,events_30d:d.n});
      }

      if(url.pathname==="/api/admin/course/validate" && request.method==="POST"){
        const {course}=await request.json();
        const errors=validateCourse(course);
        return json({valid:errors.length===0,errors,lesson_count:course?.lessons?.length||0});
      }

      if(url.pathname==="/api/admin/course/import" && request.method==="POST"){
        const {course}=await request.json();
        const errors=validateCourse(course);
        if(errors.length)return json({error:"Validation failed",errors},400);

        const versionId=crypto.randomUUID();
        const courseId=course.course_id;
        const body=JSON.stringify(course);
        const objectKey=`drafts/${safePart(courseId)}/${versionId}/course.json`;
        const checksum=await sha256(body);
        const createdAt=now();

        await env.ASSETS.put(objectKey,body,{
          httpMetadata:{contentType:"application/json; charset=utf-8"},
          customMetadata:{
            course_id:courseId,
            version_id:versionId,
            version_label:String(course.version||"draft"),
            status:"draft",
            sha256:checksum
          }
        });

        try{
          await env.DB.prepare(
            `INSERT INTO courses
            (course_id,title_en,title_kh,published,created_at,updated_at)
            VALUES(?,?,?,?,?,?)
            ON CONFLICT(course_id) DO UPDATE SET
            title_en=excluded.title_en,
            title_kh=excluded.title_kh,
            updated_at=excluded.updated_at`
          ).bind(courseId,course.title?.en||"",course.title?.kh||"",0,createdAt,createdAt).run();

          await env.DB.prepare(
            `INSERT INTO course_versions
            (version_id,course_id,version_label,status,r2_object_key,content_sha256,byte_size,created_at)
            VALUES(?,?,?,?,?,?,?,?)`
          ).bind(versionId,courseId,course.version||"draft","draft",objectKey,checksum,textEncoder.encode(body).byteLength,createdAt).run();
        }catch(error){
          await env.ASSETS.delete(objectKey);
          throw error;
        }

        return json({ok:true,version_id:versionId,r2_object_key:objectKey,sha256:checksum});
      }

      if(url.pathname==="/api/admin/course/versions" && request.method==="GET"){
        const rows=await env.DB.prepare(
          `SELECT version_id,course_id,version_label,status,r2_object_key,byte_size,created_at,published_at
           FROM course_versions ORDER BY created_at DESC LIMIT 100`
        ).all();
        return json({versions:rows.results});
      }

      if(url.pathname==="/api/admin/course/publish" && request.method==="POST"){
        const {version_id}=await request.json();
        const row=await getVersion(env,version_id);
        if(!row)return json({error:"Unknown course version"},404);

        const course=await readCourseFromR2(env,row);
        const publishedKey=`catalog/${safePart(row.course_id)}/${safePart(row.version_label||row.version_id)}/course.json`;
        const body=JSON.stringify(course);
        await env.ASSETS.put(publishedKey,body,{
          httpMetadata:{contentType:"application/json; charset=utf-8"},
          customMetadata:{course_id:row.course_id,version_id:row.version_id,status:"published"}
        });

        const publishedAt=now();
        await env.DB.batch([
          env.DB.prepare(
            `UPDATE course_versions SET status='published',r2_object_key=?,published_at=? WHERE version_id=?`
          ).bind(publishedKey,publishedAt,row.version_id),
          env.DB.prepare(
            `UPDATE courses SET current_version_id=?,published=1,updated_at=? WHERE course_id=?`
          ).bind(row.version_id,publishedAt,row.course_id)
        ]);

        if(row.r2_object_key!==publishedKey && row.r2_object_key?.startsWith("drafts/")){
          await env.ASSETS.delete(row.r2_object_key);
        }
        return json({ok:true,version_id:row.version_id,r2_object_key:publishedKey,published_at:publishedAt});
      }

      if(url.pathname==="/api/admin/review" && request.method==="POST"){
        const body=await request.json();
        const row=await getVersion(env,body.version_id);
        if(!row)return json({error:"Unknown course version"},404);
        const course=await readCourseFromR2(env,row);

        const reviewId=crypto.randomUUID();
        const suggestions=await callProvider(env,body.provider,body.model,body.focus,course);
        await env.DB.prepare(
          `INSERT INTO review_runs
          (review_id,version_id,provider,model,focus,result_json,status,created_at)
          VALUES(?,?,?,?,?,?,?,?)`
        ).bind(reviewId,body.version_id,body.provider,body.model,body.focus,JSON.stringify(suggestions),"complete",now()).run();
        return json({review_id:reviewId,result:suggestions});
      }

      if(url.pathname==="/api/admin/analytics/overview" && request.method==="GET"){
        const active=await env.DB.prepare("SELECT COUNT(DISTINCT installation_id) n FROM analytics_events WHERE created_at>=datetime('now','-7 days')").first();
        const opens=await env.DB.prepare("SELECT COUNT(*) n FROM analytics_events WHERE event_type='lesson_opened' AND created_at>=datetime('now','-7 days')").first();
        const plays=await env.DB.prepare("SELECT COUNT(*) n FROM analytics_events WHERE event_type='audio_played' AND created_at>=datetime('now','-7 days')").first();
        const downloads=await env.DB.prepare("SELECT COUNT(*) n FROM analytics_events WHERE event_type='offline_download_completed' AND created_at>=datetime('now','-7 days')").first();
        const top=await env.DB.prepare(`SELECT lesson_id,COUNT(*) opens FROM analytics_events WHERE event_type='lesson_opened' GROUP BY lesson_id ORDER BY opens DESC LIMIT 20`).all();
        return json({active_installations_7d:active.n,lesson_opens_7d:opens.n,audio_plays_7d:plays.n,offline_downloads_7d:downloads.n,top_lessons:top.results});
      }

      return json({error:"Not found"},404);
    }catch(e){
      const status=e.message==="Admin access denied."?403:500;
      return json({error:e.message||String(e)},status);
    }
  }
};

function requireAdmin(request,env){
  const email=request.headers.get("Cf-Access-Authenticated-User-Email")||"";
  if(!email)throw new Error("Admin access denied.");
  if(env.ADMIN_EMAIL && email.toLowerCase()!==env.ADMIN_EMAIL.toLowerCase())throw new Error("Admin access denied.");
}
function requireBindings(env){
  if(!env.DB)throw new Error("Missing D1 binding: DB");
  if(!env.ASSETS)throw new Error("Missing R2 binding: ASSETS");
}
function safePart(value){return String(value||"").toLowerCase().replace(/[^a-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"")||"unnamed"}
async function sha256(text){
  const digest=await crypto.subtle.digest("SHA-256",textEncoder.encode(text));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function getVersion(env,versionId){
  return env.DB.prepare(`SELECT version_id,course_id,version_label,status,r2_object_key FROM course_versions WHERE version_id=?`).bind(versionId).first();
}
async function readCourseFromR2(env,row){
  if(!row.r2_object_key)throw new Error("Course version has no R2 object key. Re-import it after applying migration 0.9.4.");
  const object=await env.ASSETS.get(row.r2_object_key);
  if(!object)throw new Error(`R2 object not found: ${row.r2_object_key}`);
  return JSON.parse(await object.text());
}
function validateCourse(c){
  const errors=[];
  if(!c||typeof c!=="object")return["Course must be a JSON object."];
  if(!c.course_id)errors.push("course_id is required.");
  if(!c.title?.en)errors.push("title.en is required.");
  if(!Array.isArray(c.lessons)||!c.lessons.length)errors.push("lessons must be a non-empty array.");
  const ids=new Set();
  for(const lesson of c.lessons||[]){
    if(!lesson.id)errors.push("Each lesson needs an id.");
    if(ids.has(lesson.id))errors.push("Duplicate lesson id: "+lesson.id);
    ids.add(lesson.id);
    if(!Array.isArray(lesson.cards))errors.push(`${lesson.id||"lesson"}: cards must be an array.`);
  }
  return errors;
}
async function callProvider(env,provider,model,focus,course){
  const prompt=`${focus}\n\nCourse JSON:\n${JSON.stringify(course)}\n\nReturn JSON only with summary, suggestions[], and warnings[].\nNever apply changes automatically.`;
  let endpoint;let headers={"Content-Type":"application/json"};let payload;
  if(provider==="openrouter"){
    endpoint="https://openrouter.ai/api/v1/chat/completions";headers.Authorization=`Bearer ${env.OPENROUTER_API_KEY}`;payload={model,messages:[{role:"user",content:prompt}],temperature:0.2};
  }else if(provider==="google"){
    endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GOOGLE_API_KEY}`;payload={contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.2,responseMimeType:"application/json"}};
  }else{
    endpoint="https://api.openai.com/v1/chat/completions";headers.Authorization=`Bearer ${env.OPENAI_API_KEY}`;payload={model,messages:[{role:"user",content:prompt}],temperature:0.2};
  }
  const response=await fetch(endpoint,{method:"POST",headers,body:JSON.stringify(payload)});
  if(!response.ok)throw new Error(`AI provider returned ${response.status}: ${(await response.text()).slice(0,500)}`);
  const data=await response.json();
  const text=provider==="google"?data.candidates[0].content.parts[0].text:data.choices[0].message.content;
  return JSON.parse(text.replace(/^```json\s*/,"").replace(/\s*```$/,"") );
}
