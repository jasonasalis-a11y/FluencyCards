# Known issues

- Existing Cloudflare secrets are not changed by this package. `keep_vars = true` is retained.
- The new image metadata migration must be applied once through the Cloudflare D1 console before image upload.
- Google review still depends on `GOOGLE_API_KEY` being present on the **fluency-engine** Worker production environment.
