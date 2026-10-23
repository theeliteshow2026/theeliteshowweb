"""Make the small and large WebP copies of each session poster.

Run from the site folder after adding a poster to posters/:
    python3 tools/poster_sizes.py
It writes posters/sm/<name>.webp (480px wide) and posters/lg/<name>.webp
(900px wide). Pages fall back to the original .jpg if a copy is missing.
Needs Pillow (pip install pillow).
"""
from pathlib import Path

from PIL import Image

POSTERS = Path(__file__).resolve().parent.parent / 'posters'
SIZES = {'sm': 480, 'lg': 900}

for src in sorted(POSTERS.glob('*.jp*g')):
    with Image.open(src) as im:
        im = im.convert('RGB')
        for folder, width in SIZES.items():
            out = POSTERS / folder / (src.stem + '.webp')
            if out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
                continue
            out.parent.mkdir(exist_ok=True)
            w = min(width, im.width)
            im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(out, 'WEBP', quality=80, method=6)
            print('wrote', out.relative_to(POSTERS.parent))
