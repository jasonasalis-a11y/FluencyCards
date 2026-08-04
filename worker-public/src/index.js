const json=(data,status=200)=>new Response(JSON.stringify(data),{
  status,
  headers:{
    "Content-Type":"application/json; charset=utf-8",
    "Access-Control-Allow-Origin":"*"
  }
});

const now=()=>new Date().toISOString();

export default {
  async fetch(request,env){
    const url=new URL(request.url);

    if(request.method==="OPTIONS"){
      return new Response(null,{headers:{
        "Access-Control-Allow-Origin":"*",
        "Access-Control-Allow-Headers":"Content-Type",
        "Access-Control-Allow-Methods":"GET,POST,OPTIONS"
      }});
    }

    try{
      if(url.pathname==="/api/health"){
        return json({ok:true,service:"fluencycards-public-api",version:"0.9.2"});
      }

      if(url.pathname==="/api/catalog" && request.method==="GET"){
        const rows=await env.DB.prepare(
          "SELECT course_id,title_en,title_kh,current_version_id FROM courses WHERE published=1 ORDER BY course_id"
        ).all();
        return json({courses:rows.results});
      }

      if(url.pathname==="/api/analytics/batch" && request.method==="POST"){
        const body=await request.json();
        const events=Array.isArray(body.events)?body.events.slice(0,500):[];

        for(const e of events){
          await env.DB.prepare(
            `INSERT OR IGNORE INTO analytics_events
            (event_id,installation_id,event_type,course_id,lesson_id,card_index,payload_json,created_at,app_version)
            VALUES(?,?,?,?,?,?,?,?,?)`
          ).bind(
            e.id,
            e.installation_id,
            e.type,
            e.course_id||"",
            e.lesson_id||"",
            Number.isInteger(e.card_index)?e.card_index:null,
            JSON.stringify(e),
            e.created_at||now(),
            e.app_version||""
          ).run();
        }

        return json({accepted:events.length});
      }

      return json({error:"Not found"},404);
    }catch(e){
      return json({error:e.message||String(e)},500);
    }
  }
};
