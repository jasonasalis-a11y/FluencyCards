#!/usr/bin/env python3
"""Generate all audio referenced by a Fluency Engine manifest using edge-tts.
Usage: python generate_audio.py manifest.json --output audio-output [--voice en-US-GuyNeural]
"""
import argparse, asyncio, json, sys
from pathlib import Path
try:
    import edge_tts
except ImportError:
    print('Missing dependency. Run: python -m pip install edge-tts', file=sys.stderr)
    raise SystemExit(2)

async def generate(item, root: Path, default_voice: str):
    path = root / item['path']
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.stat().st_size:
        return {'path': item['path'], 'status': 'existing'}
    text = str(item.get('text') or '').strip()
    if not text:
        return {'path': item['path'], 'status': 'skipped', 'error': 'No text'}
    voice = item.get('voice') or default_voice
    await edge_tts.Communicate(text=text, voice=voice).save(str(path))
    return {'path': item['path'], 'status': 'generated', 'voice': voice}

async def main_async(args):
    data = json.loads(Path(args.manifest).read_text(encoding='utf-8'))
    root = Path(args.output)
    voice = args.voice or data.get('voice') or 'en-US-GuyNeural'
    results=[]
    for n,item in enumerate(data.get('items',[]),1):
        try: result=await generate(item,root,voice)
        except Exception as exc: result={'path':item.get('path',''),'status':'failed','error':str(exc)}
        results.append(result); print(f"[{n}/{len(data.get('items',[]))}] {result['status']}: {result['path']}")
    (root/'generation-report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    failed=[r for r in results if r['status']=='failed']
    return 1 if failed else 0

def main():
    p=argparse.ArgumentParser();p.add_argument('manifest');p.add_argument('--output',default='audio-output');p.add_argument('--voice')
    args=p.parse_args();raise SystemExit(asyncio.run(main_async(args)))
if __name__=='__main__':main()
