# FluencyCards v0.9.1 Architecture

- **GitHub:** canonical source code and portable course packages.
- **Cloudflare Pages/Workers:** public student PWA, private hosted admin, API, analytics ingestion, AI review, and publishing.
- **Cloudflare D1:** course versions, review history, audit records, and MVP analytics.
- **Worker secrets:** AI provider API keys.
- **Pixel/Termux:** optional local builder and direct LLM-assisted bulk course generation.
- **Portable course packages:** allow entire courses to move between LLMs, GitHub, the local builder, and Cloudflare.
- **Human approval:** required before course text or audio is published.
