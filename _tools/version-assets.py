#!/usr/bin/env python3
"""Stamp the CSS and JS links in every page with a hash of the file's content.

Browsers and GitHub Pages cache /assets/css/site.css and /assets/js/site.js.
A changing ?v= query forces them to fetch the new version after each update.
Run from the repository root after editing site.css or site.js:

    python3 _tools/version-assets.py
"""
import hashlib
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ['assets/css/site.css', 'assets/js/site.js']

versions = {a: hashlib.sha256((ROOT / a).read_bytes()).hexdigest()[:10] for a in ASSETS}

for page in sorted(ROOT.glob('**/*.html')):
    if any(part.startswith(('_', '.')) for part in page.relative_to(ROOT).parts):
        continue
    text = page.read_text(encoding='utf-8')
    new = text
    for asset, version in versions.items():
        new = re.sub(r'/' + re.escape(asset) + r'(\?v=[0-9a-f]+)?"', f'/{asset}?v={version}"', new)
    if new != text:
        page.write_text(new, encoding='utf-8')
        print('updated', page.relative_to(ROOT))
