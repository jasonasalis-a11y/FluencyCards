const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type,Authorization","Access-Control-Allow-Methods":"GET,POST,PUT,OPTIONS"};
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8",...CORS,...extra}});
const now=()=>new Date().toISOString();
const enc=new TextEncoder();

export default {async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==='OPTIONS')return new Response(null,{headers:CORS});
  try{
    requireAdmin(request,env); requireBindings(env);
    if(url.pathname==='/api/health')return json({ok:true,service:'fluency-engine-admin',version:'0.9.6.2',storage:'r2'});
    if(url.pathname==='/api/admin/diagnostics')return await diagnostics(env);
    if(url.pathname==='/api/admin/summary')return await summary(env);
    if(url.pathname==='/api/admin/course/validate'&&request.method==='POST')return await validateEndpoint(request);
    if(url.pathname==='/api/admin/course/import'&&request.method==='POST')return await importCourse(request,env);
    if(url.pathname==='/api/admin/course/versions')return await listVersions(env);
    if(url.pathname==='/api/admin/course/get')return await getCourse(url,env);
    if(url.pathname==='/api/admin/review'&&request.method==='POST')return await reviewCourse(request,env);
    if(url.pathname==='/api/admin/provider/test'&&request.method==='POST')return await testProvider(request,env);
    if(url.pathname==='/api/admin/audio/manifest')return await audioManifest(url,env);
    if(url.pathname==='/api/admin/audio/upload'&&request.method==='POST')return await uploadAudio(request,env);
    if(url.pathname==='/api/admin/audio/status')return await audioStatus(url,env);
    if(url.pathname==='/api/admin/course/readiness')return await courseReadiness(url,env);
    if(url.pathname==='/api/admin/course/publish'&&request.method==='POST')return await publishCourse(request,env);
    if(url.pathname==='/api/admin/analytics/overview')return await analytics(env);
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
function cleanSecret(value){let s=String(value||'').replace(/[\u200B-\u200D\uFEFF]/g,'').trim();if((s.startsWith('\"')&&s.endsWith('\"'))||(s.startsWith("'")&&s.endsWith("'")))s=s.slice(1,-1).trim();return s}
function secretInfo(value){const s=cleanSecret(value);return {configured:!!s,length:s.length,prefix:s?`${s.slice(0,3)}…`:'',suffix:s?`…${s.slice(-4)}`:''}}
const REVIEW_SCHEMA={type:'object',additionalProperties:false,properties:{summary:{type:'string'},suggestions:{type:'array',items:{type:'string'}},warnings:{type:'array',items:{type:'string'}}},required:['summary','suggestions','warnings']};

export function validateCourse(c){
  const errors=[],warnings=[];
  if(!c||typeof c!=='object')return {valid:false,errors:['Course must be a JSON object.'],warnings};
  if(!c.course_id)errors.push('course_id is required.');
  if(!titleLearning(c))errors.push('title.learning (or title.en) is required.');
  if(!Array.isArray(c.lessons)||!c.lessons.length)errors.push('lessons must be a non-empty array.');
  const lessonIds=new Set();
  for(const lesson of c.lessons||[]){
    const lessonId=lesson?.id||'lesson';
    if(!lesson?.id)errors.push('Each lesson needs an id.');
    else if(lessonIds.has(lesson.id))errors.push(`Duplicate lesson id: ${lesson.id}`);
    else lessonIds.add(lesson.id);

    const collections={skills:lesson?.skills,cards:lesson?.cards,activities:lesson?.activities,assessment:lesson?.assessment};
    if(!Object.values(collections).some(x=>Array.isArray(x)&&x.length))errors.push(`${lessonId}: needs cards, skills, activities, or assessment items.`);

    // IDs identify definitions within their own collection. A skill may be referenced by
    // activities or assessments without becoming a duplicate skill definition.
    for(const [name,collection] of Object.entries(collections)){
      if(!Array.isArray(collection))continue;
      const ids=new Set();
      for(const item of collection){
        if(!item?.id)continue;
        if(ids.has(item.id))errors.push(`Duplicate ${name.slice(0,-1)} id in ${lessonId}: ${item.id}`);
        else ids.add(item.id);
      }
    }
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
async function diagnostics(env){return json({version:'0.9.6.2',bindings:{DB:!!env.DB,ASSETS:!!env.ASSETS},providers:{google:secretInfo(env.GOOGLE_API_KEY||env.GEMINI_API_KEY),openai:secretInfo(env.OPENAI_API_KEY),openrouter:secretInfo(env.OPENROUTER_API_KEY)},secrets_expected:['GOOGLE_API_KEY','OPENAI_API_KEY','OPENROUTER_API_KEY']})}
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
    const key=cleanSecret(env.GOOGLE_API_KEY||env.GEMINI_API_KEY);if(!key)throw new Error('Google key missing: add GOOGLE_API_KEY to the fluency-engine Worker.');
    const m=normalizeGoogleModel(model);return {endpoint:`https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(m)}:generateContent`,headers:{'Content-Type':'application/json','x-goog-api-key':key},payload:{contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.2,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{summary:{type:'STRING'},suggestions:{type:'ARRAY',items:{type:'STRING'}},warnings:{type:'ARRAY',items:{type:'STRING'}}},required:['summary','suggestions','warnings']}}},model:m};
  }
  if(provider==='openai'){
    const key=cleanSecret(env.OPENAI_API_KEY);if(!key)throw new Error('OpenAI key missing: add OPENAI_API_KEY to the fluency-engine Worker.');
    const m=String(model||'gpt-5-mini').trim();return {endpoint:'https://api.openai.com/v1/responses',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},payload:{model:m,input:prompt,text:{format:{type:'json_schema',name:'course_review',strict:true,schema:REVIEW_SCHEMA}}},model:m};
  }
  if(provider==='openrouter'){
    const key=cleanSecret(env.OPENROUTER_API_KEY);if(!key)throw new Error('OpenRouter key missing: add OPENROUTER_API_KEY to the fluency-engine Worker.');
    const m=String(model||'google/gemini-3.6-flash').trim();return {endpoint:'https://openrouter.ai/api/v1/chat/completions',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`,'HTTP-Referer':origin,'X-OpenRouter-Title':'Fluency Engine'},payload:{model:m,messages:[{role:'user',content:prompt}],temperature:0.2,response_format:{type:'json_object'}},model:m};
  }
  throw new Error(`Unknown provider: ${provider}`);
}
function normalizeGoogleModel(model){const v=String(model||'').trim(),c=v.toLowerCase().replace(/[\s._-]+/g,'');if(!v||c==='flash36'||c==='geminiflash36'||c==='gemini36flash')return 'gemini-3.6-flash';return v}
function extractProviderText(provider,data){
  if(provider==='google')return data?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')||'';
  if(provider==='openai')return data?.output?.filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text||'').join('')||data?.output_text||'';
  return data?.choices?.[0]?.message?.content||'';
}
function parseJsonText(text){const cleaned=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');try{return JSON.parse(cleaned)}catch{throw new Error(`Provider returned non-JSON output: ${cleaned.slice(0,500)}`)}}
async function callProvider(env,provider,model,focus,course,origin,{structured=true}={}){
  const prompt=`${focus}\n\nCourse JSON:\n${JSON.stringify(course)}\n\n${structured?'Return one JSON object with keys summary, suggestions, warnings. Never apply changes automatically.':'Reply with a short confirmation that the provider connection works.'}`;
  const req=providerRequest(provider,model,prompt,env,origin);
  if(!structured){
    if(provider==='google')delete req.payload.generationConfig;
    if(provider==='openai')delete req.payload.text;
    if(provider==='openrouter')delete req.payload.response_format;
  }
  let response,raw,data;
  for(let attempt=0;attempt<2;attempt++){
    try{response=await fetchWithTimeout(req.endpoint,{method:'POST',headers:req.headers,body:JSON.stringify(req.payload)},60000)}
    catch(e){
      if(attempt===0)continue;
      const err=new Error(`Provider ${provider} request failed before a response: ${e?.message||String(e)}`);
      err.status=502;err.details={stage:'fetch',provider,model:req.model,endpoint:req.endpoint};throw err;
    }
    raw=await response.text();
    try{data=raw?JSON.parse(raw):{}}catch{data={raw:raw.slice(0,4000)}}
    if(response.ok)break;
    if(attempt===0&&(response.status===429||response.status===503)){
      const wait=Math.min(5000,Math.max(500,Number(response.headers.get('Retry-After')||1)*1000));await new Promise(r=>setTimeout(r,wait));continue;
    }
    const keyValue=provider==='google'?(env.GOOGLE_API_KEY||env.GEMINI_API_KEY):provider==='openai'?env.OPENAI_API_KEY:env.OPENROUTER_API_KEY;
    const err=new Error(`${provider} returned HTTP ${response.status}: ${data?.error?.message||data?.message||raw.slice(0,400)}`);
    err.status=502;err.details={stage:'provider_response',provider,model:req.model,http_status:response.status,endpoint:req.endpoint,request_id:response.headers.get('x-request-id')||response.headers.get('x-goog-request-id')||null,key:secretInfo(keyValue),provider_error:data};throw err;
  }
  const text=extractProviderText(provider,data);
  if(!text){const err=new Error(`${provider} returned no text.`);err.status=502;err.details={stage:'response_parse',provider,model:req.model,response:data};throw err}
  return structured?parseJsonText(text):{message:text.slice(0,1000)};
}
async function fetchWithTimeout(url,options,ms){const c=new AbortController(),t=setTimeout(()=>c.abort('Provider request timed out.'),ms);try{return await fetch(url,{...options,signal:c.signal})}finally{clearTimeout(t)}}
async function reviewCourse(request,env){
  const body=await request.json(),row=await getVersion(env,body.version_id);if(!row)return json({error:'Unknown course version'},404);
  const course=await readCourse(env,row),result=await callProvider(env,body.provider,body.model,body.focus||'Review this course.',course,new URL(request.url).origin,{structured:true});
  const reviewId=crypto.randomUUID();await env.DB.prepare(`INSERT INTO review_runs(review_id,version_id,provider,model,focus,result_json,status,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(reviewId,row.version_id,body.provider,body.model,body.focus||'',JSON.stringify(result),'complete',now()).run();return json({ok:true,review_id:reviewId,result});
}
async function testProvider(request,env){
  const body=await request.json(),started=Date.now();
  const sample={course_id:'provider-test',title:{learning:'Provider test'},learning_language:'en-US',lessons:[{id:'T1',skills:[{id:'S1',learning_text:'Hello.',native_text:'Test.'}]}]};
  const result=await callProvider(env,body.provider,body.model,'This is a provider connectivity test.',sample,new URL(request.url).origin,{structured:false});
  return json({ok:true,provider:body.provider,model:body.model,elapsed_ms:Date.now()-started,result});
}
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
async function readinessForVersion(env,versionId){
  const m=await manifestForVersion(env,versionId),validation=validateCourse(m.course),errors=[...validation.errors],warnings=[...validation.warnings],missing=[];
  for(const item of m.items)if(!(await env.ASSETS.head(item.path)))missing.push(item.path);
  if(missing.length)errors.push(`${missing.length} required audio file(s) are missing.`);
  const review=await env.DB.prepare(`SELECT COUNT(*) n,MAX(created_at) latest FROM review_runs WHERE version_id=? AND status='complete'`).bind(versionId).first();
  if(!review?.n)warnings.push('No completed AI review is recorded. AI review is recommended but not required.');
  return {version_id:versionId,valid:errors.length===0,can_publish:errors.length===0,errors,warnings,missing_audio:missing,audio_total:m.items.length,audio_present:m.items.length-missing.length,completed_reviews:Number(review?.n||0),latest_review_at:review?.latest||null,course:m.course,row:m.row};
}
async function courseReadiness(url,env){const r=await readinessForVersion(env,url.searchParams.get('version_id'));const {course,row,...publicResult}=r;return json(publicResult)}
async function publishCourse(request,env){
  const {version_id,confirm_warnings=false}=await request.json(),r=await readinessForVersion(env,version_id);if(!r.can_publish)return json({error:'Course has blocking validation errors.',errors:r.errors,warnings:r.warnings,missing_audio:r.missing_audio},400);
  if(r.warnings.length&&!confirm_warnings)return json({error:'Publication has warnings. Confirm to publish anyway.',requires_confirmation:true,warnings:r.warnings},409);
  const items=collectAudioRefs(r.course),key=`catalog/${safe(r.row.course_id)}/${safe(r.row.version_label||r.row.version_id)}/course.json`,body=JSON.stringify(r.course),checksum=await sha256(body),publishedAt=now();await env.ASSETS.put(key,body,{httpMetadata:{contentType:'application/json; charset=utf-8'},customMetadata:{course_id:r.row.course_id,version_id:r.row.version_id,status:'published'}});
  await env.DB.batch([env.DB.prepare(`UPDATE course_versions SET status='published',r2_object_key=?,content_sha256=?,byte_size=?,published_at=? WHERE version_id=?`).bind(key,checksum,enc.encode(body).byteLength,publishedAt,r.row.version_id),env.DB.prepare(`UPDATE courses SET current_version_id=?,published=1,updated_at=? WHERE course_id=?`).bind(r.row.version_id,publishedAt,r.row.course_id)]);
  if(r.row.r2_object_key!==key&&r.row.r2_object_key?.startsWith('drafts/'))await env.ASSETS.delete(r.row.r2_object_key);
  return json({ok:true,version_id:r.row.version_id,r2_object_key:key,published_at:publishedAt,audio_count:items.length,published_with_warnings:r.warnings});
}

async function analytics(env){const [a,b,c,d,top]=await Promise.all([env.DB.prepare("SELECT COUNT(DISTINCT installation_id) n FROM analytics_events WHERE created_at>=datetime('now','-7 days')").first(),env.DB.prepare("SELECT COUNT(*) n FROM analytics_events WHERE event_type='lesson_opened' AND created_at>=datetime('now','-7 days')").first(),env.DB.prepare("SELECT COUNT(*) n FROM analytics_events WHERE event_type='audio_played' AND created_at>=datetime('now','-7 days')").first(),env.DB.prepare("SELECT COUNT(*) n FROM analytics_events WHERE event_type='offline_download_completed' AND created_at>=datetime('now','-7 days')").first(),env.DB.prepare(`SELECT lesson_id,COUNT(*) opens FROM analytics_events WHERE event_type='lesson_opened' GROUP BY lesson_id ORDER BY opens DESC LIMIT 20`).all()]);return json({active_installations_7d:a.n,lesson_opens_7d:b.n,audio_plays_7d:c.n,offline_downloads_7d:d.n,top_lessons:top.results})}
