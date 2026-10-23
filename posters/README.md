Drop each Saturday session's poster here (portrait, about 4:5, JPG or WebP under ~400 KB),
then point that session's `poster` field in `mentor_sessions.js` at it, e.g. `posters/2026-10-10.jpg`.

After adding a poster, run `python3 tools/poster_sizes.py` to make its small and large WebP copies
(posters/sm and posters/lg). Phones then download the small one. Without the copies the page still
works and uses the original file.
