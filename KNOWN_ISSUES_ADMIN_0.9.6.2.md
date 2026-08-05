# Known Issues

- Live provider calls require valid secrets in the `fluency-engine` Worker.
- This package does not alter or deploy the public PWA.
- External providers may reject unavailable model identifiers; these failures now return structured JSON instead of Cloudflare HTML error pages.
