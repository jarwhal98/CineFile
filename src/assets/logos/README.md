Logo assets for list sources

How it works
- Files placed here are auto-discovered at build/runtime via Vite’s import.meta.glob.
- ListDetail’s progress square will try to match a logo for the current list based on:
  1) list.slug
  2) list.source
  3) list.name

Matching rules
- Filenames are compared after slugifying: lowercase, non-alphanumerics replaced with dashes, and leading/trailing dashes trimmed.
- Example mappings:
  - "NYTimes" or "New York Times" -> nytimes.png (ny-times.png also works)
  - "TSPDT" -> tspdt.svg
  - "Rolling Stone" -> rolling-stone.png
  - "Variety" -> variety.png
  - "User" -> user.png

Recommended
- Prefer SVG or high-res transparent PNGs.
- Keep logos centered with adequate transparent padding (square-ish canvas recommended).
- Avoid very dark/black-only marks; mid-tone works best with the washed-out styling.

Supported formats
- .svg, .png, .jpg, .jpeg, .webp (anything Vite can import as an asset).

Styling in app
- The logo is shown behind the circular progress in a washed-out, grayscale style at ~70% size and low opacity.

Troubleshooting
- If a logo doesn’t appear, check the filename matches the slugified source.
- You can inspect the computed candidates: slug, source, or name for your list, then rename the file to match one of those.
