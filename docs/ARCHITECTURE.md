# FluencyCards v0.9.2 Architecture

- **GitHub:** canonical source code and portable course packages.
- **Student PWA:** public offline-first learning application.
- **Public Worker (`worker-public/`):** public course catalog and analytics ingestion.
- **Private Worker (`worker-admin/`):** course import, AI review, publishing, and analytics dashboards.
- **Cloudflare Access:** protects the private admin UI and private Worker.
- **Cloudflare D1:** course versions, review history, audit records, and MVP analytics.
- **Worker secrets:** AI provider API keys, stored only on the private Worker.
- **Pixel/Termux:** optional local builder and direct LLM-assisted bulk course generation.
- **Portable course packages:** move courses between LLMs, GitHub, the local builder, and Cloudflare.
- **Human approval:** required before course text or audio is published.
