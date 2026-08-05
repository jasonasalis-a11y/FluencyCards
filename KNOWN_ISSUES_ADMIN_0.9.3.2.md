# Known issues

- Gemini provider testing still depends on the live Cloudflare secret binding and Google key configuration; this release does not change that integration.
- Image normalization occurs in the Admin browser before the resulting WebP is sent to the Admin Worker and written to R2.
