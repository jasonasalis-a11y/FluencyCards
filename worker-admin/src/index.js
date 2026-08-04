const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type,Authorization","Access-Control-Allow-Methods":"GET,POST,PUT,OPTIONS"};
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8",...CORS,...extra}});
const now=()=>new Date().toISOString();
const enc=new TextEncoder();

export default {async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==='OPTIONS')return new Response(null,{headers:CORS});
  try{
    requireAdmin(request,env); requireBindings(env);
    if(url.pathname==='/api/health')return json({ok:true,service:'fluency-engine-admin',version:'0.9.5-beta',storage:'r2'});
    if(url.pathname==='/api/admin/diagnostics')return diagnostics(env);
    if(url.pathname==='/api/admin/summary')return summary(env);
    if(url.pathname==='/api/admin/course/validate'&&request.method==='POST')return validateEndpoint(request);
    if(url.pathname==='/api/admin/course/import'&&request.method==='POST')return importCourse(request,env);
    if(url.pathname==='/api/admin/course/versions')return listVersions(env);
    if(url.pathname==='/api/admin/course/get')return getCourse(url,env);
    if(url.pathname==='/api/admin/review'&&request.method==='POST')return reviewCourse(request,env);
    if(url.pathname==='/api/admin/audio/manifest')return audioManifest(url,env);
    if(url.pathname==='/api/admin/audio/upload'&&request.method==='POST')return uploadAudio(request,env);
    if(url.pathname==='/api/admin/audio/status')return audioStatus(url,env);
    if(url.pathname==='/api/admin/course/publish'&&request.method==='POST')return publishCourse(request,env);
    if(url.pathname==='/api/admin/analytics/overview')return analytics(env);
    return json({error:'Not found'},404);
  }catch(error){
    const status=error.status|| (error.message==='Admin access denied.'?403:500);
    return json({error:error.message||String(error),details:error.details||undefined},status);
  }
}};

function requireBindings(env){if(!env.DB)throw new Error('Missing D1 binding: DB');if(!env.ASSETS)throw new Error('Missing R2 binding: ASSETS')}
function requireAdmin(request,env){
  const email=request.headers.get('Cf-Access-Authenticated-User-Email')||'';
  const configured=String(env.ADMIN_EMAIL||'').trim();
  if(email){if(configured&&!configured.includes('REPLACE_WITH')&&email.toLowerCase()!==configured.toLowerCase())throw new Error('Admin access denied.');return}
  const token=String(env.ADMIN_TOKEN||'').trim();
  if(token){const supplied=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');if(supplied!==token)throw new Error('Admin access denied.');return}
  const origin=request.headers.get('Origin');
  if(origin&&origin!==new URL(request.url).origin)throw new Error('Admin access denied.');
}
function safe(v){return String(v||'').toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'unnamed'}
async function sha256(text){const d=await crypto.subtle.digest('SHA-256',enc.encode(text));return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function titleLearning(c){return c?.title?.learning||c?.title?.en||c?.title_en||''}
function titleNative(c){return c?.title?.native||c?.title?.kh||c?.title_kh||''}

export function validateCourse(c){
  const errors=[],warnings=[];
  if(!c||typeof c!=='object')return {valid:false,errors:['Course must be a JSON object.'],warnings};
  if(!c.course_id)errors.push('course_id is required.');
  if(!titleLearning(c))errors.push('title.learning (or title.en) is required.');
  if(!Array.isArray(c.lessons)||!c.lessons.length)errors.push('lessons must be a non-empty array.');
  const lessonIds=new Set(),itemIds=new Set();
  for(const lesson of c.lessons||[]){
    if(!lesson.id)errors.push('Each lesson needs an id.');
    if(lessonIds.has(lesson.id))errors.push(`Duplicate lesson id: ${lesson.id}`); lessonIds.add(lesson.id);
    const collections=[lesson.cards,lesson.skills,lesson.activities,lesson.assessment].filter(Array.isArray);
    if(!collections.some(x=>x.length))errors.push(`${lesson.id||'lesson'}: needs cards, skills, activities, or assessment items.`);
    for(const collection of collections)for(const item of collection){if(item?.id){if(itemIds.has(item.id))errors.push(`Duplicate item id: ${item.id}`);itemIds.add(item.id)}}
  }
  const audio=collectAudioRefs(c);
  if(!audio.length)warnings.push('No audio references were found.');
  return {valid:errors.length===0,errors,warnings,lesson_count:c.lessons?.length||0,audio_reference_count:audio.length};
}
export function collectAudioRefs(course){
  const out=new Map();
  const add=(path,text,itemId,language)=>{if(!path)return;const key=String(path).replace(/^\//,'');if(!out.has(key))out.set(key,{path:key,text:text||'',item_id:itemId||'',language:language||course.learning_language||'en-US'})};
  for(const lesson of course.lessons||[]){
    for(const s of lesson.skills||[])add(s.model_audio,s.learning_text,s.id,course.learning_language);
    for(const c of lesson.cards||[])add(c.audio||c.model_audio,c.learning_text||c.english||c.back?.text,c.id,course.learning_language);
    for(const a of [...(lesson.activities||[]),...(lesson.assessment||[])]){
      add(a.model_audio,a.learning_text||a.expected?.text,a.id,course.learning_language);
      for(const t of a.turns||[])add(t.audio,t.learning_text,t.id||a.id,course.learning_language);
    }
  }
  return [...out.values()];
}
async function getVersion(env,id){return env.DB.prepare('SELECT version_id,course_id,version_label,status,r2_object_key FROM course_versions WHERE version_id=?').bind(id).first()}
async function readCourse(env,row){if(!row?.r2_object_key)throw new Error('Course version has no R2 object key.');const obj=await env.ASSETS.get(row.r2_object_key);if(!obj)throw new Error(`R2 object not found: ${row.r2_object_key}`);return JSON.parse(await obj.text())}
async function diagnostics(env){return json({version:'0.9.5-beta',bindings:{DB:!!env.DB,ASSETS:!!env.ASSETS},providers:{google:!!(env.GOOGLE_API_KEY||env.GEMINI_API_KEY),openai:!!env.OPENAI_API_KEY,openrouter:!!env.OPENROUTER_API_KEY},secrets_expected:['GOOGLE_API_KEY','OPENAI_API_KEY','OPENROUTER_API_KEY']})}
async function summary(env){const [a,b,c,d]=await Promise.all([env.DB.prepare('SELECT COUNT(*) n FROM courses').first(),env.DB.prepare('SELECT COUNT(*) n FROM course_versions').first(),env.DB.prepare('SELECT COUNT(DISTINCT installation_id) n FROM analytics_events').first(),env.DB.prepare("SELECT COUNT(*) n FROM analytics_events WHERE created_at>=datetime('now','-30 days')").first()]);return json({courses:a.n,course_versions:b.n,installations:c.n,events_30d:d.n})}
async function validateEndpoint(request){const {course}=await request.json();return json(validateCourse(course))}
async function importCourse(request,env){
  const {course}=await request.json();const validation=validateCourse(course);if(!validation.valid)return json({error:'Validation failed',...validation},400);
  const versionId=crypto.randomUUID(),courseId=course.course_id,body=JSON.stringify(course),key=`drafts/${safe(courseId)}/${versionId}/course.json`,checksum=await sha256(body),created=now();
  await env.ASSETS.put(key,body,{httpMetadata:{contentType:'application/json; charset=utf-8'},customMetadata:{course_id:courseId,version_id:versionId,status:'draft',sha256:checksum}});
  try{await env.DB.batch([
    env.DB.prepare(`INSERT INTO courses(course_id,title_en,title_kh,published,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(course_id) DO UPDATE SET title_en=excluded.title_en,title_kh=excluded.title_kh,updated_at=excluded.updated_at`).bind(courseId,titleLearning(course),titleNative(course),0,created,created),
    env.DB.prepare(`INSERT INTO course_versions(version_id,course_id,version_label,status,r2_object_key,content_sha256,byte_size,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(versionId,courseId,course.version||'draft','draft',key,checksum,enc.encode(body).byteLength,created)
  ])}catch(e){await env.ASSETS.delete(key);throw e}
  return json({ok:true,version_id:versionId,r2_object_key:key,sha256:checksum,...validation});
}
async function listVersions(env){const r=await env.DB.prepare(`SELECT version_id,course_id,version_label,status,r2_object_key,byte_size,created_at,published_at FROM course_versions ORDER BY created_at DESC LIMIT 100`).all();return json({versions:r.results})}
async function getCourse(url,env){const id=url.searchParams.get('version_id');const row=await getVersion(env,id);if(!row)return json({error:'Unknown course version'},404);return json({version:row,course:await readCourse(env,row)})}

export function providerRequest(provider,model,prompt,env,origin='https://fluency-engine.invalid'){
  if(provider==='google'){
    const key=String(env.GOOGLE_API_KEY||env.GEMINI_API_KEY||'').trim();if(!key)throw new Error('Google key missing: add GOOGLE_API_KEY to the fluency-engine Worker.');
    const m=normalizeGoogleModel(model);return {endpoint:`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,headers:{'Content-Type':'application/json','x-goog-api-key':key},payload:{contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.2,responseMimeType:'application/json'}},model:m};
  }
  if(provider==='openai'){
    const key=String(env.OPENAI_API_KEY||'').trim();if(!key)throw new Error('OpenAI key missing: add OPENAI_API_KEY to the fluency-engine Worker.');
    const m=String(model||'gpt-5-mini').trim();return {endpoint:'https://api.openai.com/v1/responses',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},payload:{model:m,input:prompt},model:m};
  }
  if(provider==='openrouter'){
    const key=String(env.OPENROUTER_API_KEY||'').trim();if(!key)throw new Error('OpenRouter key missing: add OPENROUTER_API_KEY to the fluency-engine Worker.');
    const m=String(model||'google/gemini-3.6-flash').trim();return {endpoint:'https://openrouter.ai/api/v1/chat/completions',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`,'HTTP-Referer':origin,'X-OpenRouter-Title':'Fluency Engine'},payload:{model:m,messages:[{role:'user',content:prompt}],temperature:0.2},model:m};
  }
  throw new Error(`Unknown provider: ${provider}`);
}
function normalizeGoogleModel(model){const v=String(model||'').trim(),c=v.toLowerCase().replace(/[\s._-]+/g,'');if(!v||c==='flash36'||c==='geminiflash36'||c==='gemini36flash')return 'gemini-3.6-flash';return v}
function extractProviderText(provider,data){
  if(provider==='google')return data?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')||'';
  if(provider==='openai')return data?.output_text||data?.output?.flatMap(x=>x.content||[]).map(x=>x.text||'').join('')||'';
  return data?.choices?.[0]?.message?.content||'';
}
function parseJsonText(text){const cleaned=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');try{return JSON.parse(cleaned)}catch{throw new Error(`Provider returned non-JSON output: ${cleaned.slice(0,500)}`)}}
async function callProvider(env,provider,model,focus,course,origin){
  const prompt=`${focus}\n\nCourse JSON:\n${JSON.stringify(course)}\n\nReturn one JSON object with keys summary, suggestions, warnings. Never apply changes automatically.`;
  const req=providerRequest(provider,model,prompt,env,origin);let response;
  try{response=await fetchWithTimeout(req.endpoint,{method:'POST',headers:req.headers,body:JSON.stringify(req.payload)},45000)}catch(e){throw new Error(`Provider ${provider} request failed before a response: ${e.message}`)}
  const raw=await response.text();let data;try{data=raw?JSON.parse(raw):{}}catch{data={raw}}
  if(!response.ok){const details={provider,model:req.model,http_status:response.status,endpoint:new URL(req.endpoint).origin,request_id:response.headers.get('x-request-id')||response.headers.get('x-goog-request-id')||null,provider_error:data};const err=new Error(`${provider} returned HTTP ${response.status}: ${data?.error?.message||data?.message||raw.slice(0,400)}`);err.status=502;err.details=details;throw err}
  return parseJsonText(extractProviderText(provider,data));
}
async function fetchWithTimeout(url,options,ms){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{...options,signal:c.signal})}finally{clearTimeout(t)}}
async function reviewCourse(request,env){const body=await request.json(),row=await getVersion(env,body.version_id);if(!row)return json({error:'Unknown course version'},404);const course=await readCourse(env,row);const result=await callProvider(env,body.provider,body.model,body.focus||'Review this course.',course,new URL(request.url).origin);const reviewId=crypto.randomUUID();await env.DB.prepare(`INSERT INTO review_runs(review_id,version_id,provider,model,focus,result_json,status,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(reviewId,row.version_id,body.provider,body.model,body.focus||'',JSON.stringify(result),'complete',now()).run();return json({review_id:reviewId,result})}
async function manifestForVersion(env,versionId){const row=await getVersion(env,versionId);if(!row)throw Object.assign(new Error('Unknown course version'),{status:404});const course=await readCourse(env,row);return {row,course,items:collectAudioRefs(course)}}
async function audioManifest(url,env){const m=await manifestForVersion(env,url.searchParams.get('version_id'));return json({version_id:m.row.version_id,course_id:m.row.course_id,items:m.items})}
async function audioStatus(url,env){const m=await manifestForVersion(env,url.searchParams.get('version_id'));const items=[];for(const item of m.items){const obj=await env.ASSETS.head(item.path);items.push({...item,present:!!obj,size:obj?.size||0})}return json({version_id:m.row.version_id,total:items.length,present:items.filter(x=>x.present).length,missing:items.filter(x=>!x.present).length,items})}
async function uploadAudio(request,env){
  const form=await request.formData(),versionId=form.get('version_id'),m=await manifestForVersion(env,versionId),allowed=new Set(m.items.map(x=>x.path));const files=form.getAll('files');if(!files.length)return json({error:'No files uploaded'},400);
  const results=[];
  for(const file of files){if(!(file instanceof File))continue;let path=String(form.get(`path:${file.name}`)||file.webkitRelativePath||file.name).replace(/^\/+/, '');if(!allowed.has(path)){const matches=m.items.filter(x=>x.path.endsWith('/'+file.name)||x.path===file.name);if(matches.length===1)path=matches[0].path}
    if(!allowed.has(path)){results.push({file:file.name,ok:false,error:'Filename/path is not referenced by the course'});continue}
    await env.ASSETS.put(path,file.stream(),{httpMetadata:{contentType:file.type||'audio/mpeg'},customMetadata:{version_id:versionId,source_type:'upload'}});
    await env.DB.prepare(`INSERT OR REPLACE INTO audio_assets(asset_id,version_id,item_id,source_type,object_key,approved,created_at) VALUES(?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),versionId,m.items.find(x=>x.path===path)?.item_id||'', 'upload',path,1,now()).run();results.push({file:file.name,path,ok:true});
  }
  return json({ok:results.some(x=>x.ok),results});
}
async function publishCourse(request,env){
  const {version_id}=await request.json(),m=await manifestForVersion(env,version_id);const validation=validateCourse(m.course);if(!validation.valid)return json({error:'Course validation failed',...validation},400);
  const missing=[];for(const item of m.items)if(!(await env.ASSETS.head(item.path)))missing.push(item.path);if(missing.length)return json({error:'Audio is incomplete. Publication is blocked.',missing_audio:missing},400);
  const key=`catalog/${safe(m.row.course_id)}/${safe(m.row.version_label||m.row.version_id)}/course.json`,body=JSON.stringify(m.course),checksum=await sha256(body),publishedAt=now();await env.ASSETS.put(key,body,{httpMetadata:{contentType:'application/json; charset=utf-8'},customMetadata:{course_id:m.row.course_id,version_id:m.row.version_id,status:'published'}});
  await env.DB.batch([env.DB.prepare(`UPDATE course_versions SET status='published',r2_object_key=?,content_sha256=?,byte_size=?,published_at=? WHERE version_id=?`).bind(key,checksum,enc.encode(body).byteLength,publishedAt,m.row.version_id),env.DB.prepare(`UPDATE courses SET current_version_id=?,published=1,updated_at=? WHERE course_id=?`).bind(m.row.version_id,publishedAt,m.row.course_id)]);
  if(m.row.r2_object_key!==key&&m.row.r2_object_key?.startsWith('drafts/'))await env.ASSETS.delete(m.row.r2_object_key);
  return json({ok:true,version_id:m.row.version_id,r2_object_key:key,published_at:publishedAt,audio_count:m.items.length});
}
async function analytics(env){const [a,b,c,d,top]=await Promise.all([env.DB.prepare("SELECT COUNT(DISTINCT installation_id) n FROM analytics_events WHERE created_at>=datetime('now','-7 days')").first(),env.DB.prepare("SELECT COUNT(*) n FROM analytics_events WHERE event_type='lesson_opened' AND created_at>=datetime('now','-7 days')").first(),env.DB.prepare("SELECT COUNT(*) n FROM analytics_events WHERE event_type='audio_played' AND created_at>=datetime('now','-7 days')").first(),env.DB.prepare("SELECT COUNT(*) n FROM analytics_events WHERE event_type='offline_download_completed' AND created_at>=datetime('now','-7 days')").first(),env.DB.prepare(`SELECT lesson_id,COUNT(*) opens FROM analytics_events WHERE event_type='lesson_opened' GROUP BY lesson_id ORDER BY opens DESC LIMIT 20`).all()]);return json({active_installations_7d:a.n,lesson_opens_7d:b.n,audio_plays_7d:c.n,offline_downloads_7d:d.n,top_lessons:top.results})}
