# Fluency Engine 0.9.5 Beta

## Install/update from Termux

After extracting this release, run one command:

```bash
bash ~/storage/downloads/FluencyEngine_v0.9.5_Beta/install-beta.sh \
  ~/storage/downloads/FluencyCards_v0.9.3/FluencyCards
```

The script refuses to overwrite a dirty Git checkout, copies the complete beta, runs JavaScript/Python checks and automated tests, commits, and pushes to GitHub.

## Cloudflare secrets on `fluency-engine`

- `GOOGLE_API_KEY`
- `OPENAI_API_KEY` (only needed to test OpenAI)
- `OPENROUTER_API_KEY` (only needed to test OpenRouter)

Existing bindings remain:

- `DB` → D1 database `fluencycards`
- `ASSETS` → R2 bucket `fluency-engine`

## Live URLs

- Admin: `https://fluency-engine.jason-a-salis.workers.dev/`
- PWA/API: `https://fluency-engine-api.jason-a-salis.workers.dev/`

## Edge TTS

See `tools/edge-tts/README.md`. The generator is intentionally local because edge-tts is an unofficial Python client rather than a supported Cloudflare Worker API.
