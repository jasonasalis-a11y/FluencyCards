from pathlib import Path
import asyncio,csv,json,shutil,sys,zipfile
try:
    import edge_tts
except ImportError:
    print("ERROR: edge-tts is not installed. Run: pip install edge-tts");sys.exit(1)

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parent
STUDENT=PROJECT/"student"
DEPLOY=PROJECT/"deploy"
DOWNLOAD=Path.home()/"storage"/"downloads"/"FluencyCards"/"deploy"
CSV=ROOT/"courses"/"english-for-khmer"/"modules"/"M01.csv"
MODULE_JSON=STUDENT/"courses"/"english-for-khmer"/"modules"/"M01.json"
AUDIO=STUDENT/"courses"/"english-for-khmer"/"audio"/"M01"
for d in (DEPLOY,DOWNLOAD,AUDIO,MODULE_JSON.parent): d.mkdir(parents=True,exist_ok=True)

with CSV.open(encoding="utf-8",newline="") as f: rows=list(csv.DictReader(f))
meta={};phrases=[];dialogue_rows=[]
for row in rows:
    t=row["type"].strip()
    if t=="meta": meta[row["id"].strip()]={"en":row["english"].strip(),"kh":row["khmer"].strip()}
    elif t=="phrase":
        rid=row["id"].strip()
        phrases.append({"id":rid,"icon":row["icon"].strip(),"english":row["english"].strip(),"khmer":row["khmer"].strip(),"audio":f"courses/english-for-khmer/audio/M01/{rid}.mp3","speaking":{"enabled":True,"expected_text":row["english"].strip(),"locale":"en-US"}})
    elif t=="dialogue": dialogue_rows.append(row)
pairs={};order=[]
for row in dialogue_rows:
    pid=row["pair_id"].strip()
    if pid not in pairs: pairs[pid]={};order.append(pid)
    rid=row["id"].strip();speaker=row["speaker"].strip().lower()
    item={"id":rid,"english":row["english"].strip(),"khmer":row["khmer"].strip(),"audio":f"courses/english-for-khmer/audio/M01/{rid}.mp3"}
    if speaker=="student": item["speaking"]={"enabled":True,"expected_text":row["english"].strip(),"locale":"en-US"}
    pairs[pid][speaker]=item
conversation=[{"pair_id":pid,**pairs[pid]} for pid in order]
def mv(k,lang,default=""): return meta.get(k,{}).get(lang) or default
module={"id":"M01","version":"0.7.2","module_number":int(mv("module_number","en","1")),"lesson_number":int(mv("lesson_number","en","1")),"title":{"en":mv("title","en","Good Morning"),"kh":mv("title","kh","អរុណសួស្តី")},"labels":{k:v for k,v in meta.items() if k not in {"module_number","lesson_number","title"}},"cards":phrases,"conversation":conversation,"review":[{"type":"multiple_choice","prompt_kh":"តើប្រយោគមួយណាមានន័យថា «តើអ្នកភ្ញាក់ហើយឬនៅ?»","choices":["Are you ready?","Are you awake?","Did you sleep well?"],"answer":1},{"type":"multiple_choice","prompt_kh":"តើប្រយោគមួយណាមានន័យថា «សូមឱ្យខ្ញុំមួយនាទី»?","choices":["Give me a minute, please.","Have a good day.","I'm getting up."],"answer":0},{"type":"multiple_choice","prompt_kh":"ជ្រើសរើសចម្លើយល្អបំផុត៖ “Are you ready?”","choices":["Yes, I'm ready.","Good morning.","Did you sleep well?"],"answer":0}]}
MODULE_JSON.write_text(json.dumps(module,ensure_ascii=False,indent=2),encoding="utf-8")
audio_items=phrases[:]
for p in conversation: audio_items.extend([p["teacher"],p["student"]])
async def generate():
    for n,item in enumerate(audio_items,1):
        p=AUDIO/f"{item['id']}.mp3"
        if p.exists() and p.stat().st_size>1000: print(f"[{n}/{len(audio_items)}] Keeping {p.name}");continue
        print(f"[{n}/{len(audio_items)}] Creating {p.name}: {item['english']}")
        await edge_tts.Communicate(item["english"],"en-US-GuyNeural",rate="-8%").save(str(p))
asyncio.run(generate())
missing=[x["id"] for x in audio_items if not (AUDIO/f"{x['id']}.mp3").exists()]
if missing: raise SystemExit("Missing audio: "+", ".join(missing))
assets=["./","index.html","catalog.json","manifest.webmanifest","icons/icon-192.svg","icons/icon-512.svg"]
sw='const CACHE="fluencycards-v072";const SHELL='+json.dumps(assets)+';self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match("index.html"))))});self.addEventListener("message",e=>{const d=e.data||{};if(d.type!=="CACHE_ASSETS")return;const port=e.ports&&e.ports[0];e.waitUntil((async()=>{try{const cache=await caches.open(CACHE);let done=0,total=d.assets.length;for(const url of d.assets){const req=new Request(url,{cache:"reload"});const resp=await fetch(req);if(!resp.ok)throw new Error(url+" returned "+resp.status);await cache.put(req,resp.clone());done++;if(port)port.postMessage({type:"progress",done,total})}if(port)port.postMessage({type:"complete"})}catch(err){if(port)port.postMessage({type:"error",message:err.message})}})())});'
(STUDENT/"service-worker.js").write_text(sw,encoding="utf-8")
zip_path=DEPLOY/"FluencyCards_PWA_v0.7.2.zip"
if zip_path.exists(): zip_path.unlink()
with zipfile.ZipFile(zip_path,"w",zipfile.ZIP_DEFLATED) as z:
    for p in STUDENT.rglob("*"):
        if p.is_file(): z.write(p,p.relative_to(STUDENT))
if not zip_path.exists() or zip_path.stat().st_size<1000: raise SystemExit("Deploy ZIP was not created.")
target=DOWNLOAD/zip_path.name;shutil.copy2(zip_path,target)
print("\nBUILD COMPLETE\nDeploy ZIP:",target)
