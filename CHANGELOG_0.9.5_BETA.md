# Fluency Engine 0.9.5 Beta

## Complete workflow

Import → AI Review → Audio → Final Validation → Publish → Study.

## AI providers

- Google Gemini: `x-goog-api-key`, `GOOGLE_API_KEY`, default `gemini-3.6-flash`.
- OpenAI: Responses API, bearer `OPENAI_API_KEY`, default `gpt-5-mini`.
- OpenRouter: Chat Completions API, bearer `OPENROUTER_API_KEY`.
- Provider-specific diagnostics include status, model, endpoint host, request ID, and provider error body.

## Audio

- Course audio references are scanned automatically.
- Multiple MP3/WAV/OGG files can be uploaded through the admin panel.
- Publication is blocked until all referenced audio exists in R2.
- Included Edge TTS batch generator creates every clip from a downloaded manifest.
- Human recordings and externally generated audio use the same upload workflow.

## PWA

- Served at the public Worker root.
- Loads catalog and course JSON from live APIs/R2.
- Streams audio from R2 through `/media/*`.
- Saves and resumes progress locally.
- Queues analytics while offline.
- Service worker caches shell, courses, and audio.
- Lesson layout is constrained to the phone viewport without page scrolling.

## Storage

- Full draft and published course JSON in R2.
- D1 stores metadata and object keys.
- Audio assets in R2 at the exact paths referenced by the course.
