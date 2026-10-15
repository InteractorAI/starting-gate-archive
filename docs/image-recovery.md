# Archived images

Article Markdown preserves the original image URLs for provenance. At render time,
`src/data/archive-images.json` resolves those URLs to files in `public/images`.
The renderer never uses a remote image URL. Image-only links to the former
Typepad lightboxes are removed as well.

`npm run check:images` parses every article with the same Markdown parser used by
the app. It checks that each image resolves to an existing local image file or to
a documented unavailable original. `npm run build` runs this check first. A new
remote image, missing file, empty file, HTML response, or unfinished recovery
blocks the build.

## Recover or retry images

The Python recovery scripts require Pillow and requests. Run them from a network
that can reach the archive; HTTP 429 stops the downloader. Use a virtual environment:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install Pillow requests
.venv/bin/python scripts/recover_images.py --originals --variants \
  --resume docs/image-recovery-report.json --output recovery-downloads
```

The worker reuses existing files, paces requests, tries an available snapshot and
the full-size Typepad original, validates downloaded pixels, and records the
source URL and SHA-256 digest. Variant recovery checks alternate saved sizes and
the Typepad asset CDN using the same immutable image ID. It stops on download
rate limits, saves progress after each image, and distinguishes temporary errors
from unavailable originals. Repeating the command resumes the same output directory.

Copy verified files from `recovery-downloads/images` into `public/images`, then:

```sh
.venv/bin/python scripts/update_image_manifest.py \
  --report recovery-downloads/report.json
cp recovery-downloads/report.json docs/image-recovery-report.json
npm run check:images
npm run build
```

Keep the report with the assets. An unavailable original gets a plain notice in
the article; it is not counted as a recovered image. Temporary failures remain
pending and block the build until recovery is finished.
