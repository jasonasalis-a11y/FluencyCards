# Fluency Engine Admin 0.9.3.2 Stabilization

- Primary image ingestion uses a ZIP selected through the document picker.
- The outer ZIP filename and internal folder names are ignored.
- Matching uses each image filename inside the archive.
- PNG and JPEG are converted automatically to WebP.
- Existing WebP is passed through only when already exactly 512×512; otherwise it is normalized.
- Every R2 image is exactly 512×512 WebP.
- ZIP safety checks reject malformed archives, unsupported compression, duplicate filenames, and unsafe paths.
- R2 uploads and D1 image catalog/link writes remain manifest-driven.
- No schema or D1 migration is required.
