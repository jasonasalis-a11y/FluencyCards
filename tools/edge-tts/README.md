# Edge TTS batch audio

1. In **Admin → Audio**, select a version and download its Edge TTS manifest.
2. Install once: `python -m pip install edge-tts`
3. Generate: `python generate_audio.py course-manifest.json --output generated-audio --voice en-US-GuyNeural`
4. In **Admin → Audio**, select all generated MP3 files and upload them. The server matches each unique filename to the exact course path.

Human recordings or audio generated with another tool can be uploaded through the same screen.
