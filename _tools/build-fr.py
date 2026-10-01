#!/usr/bin/env python3
"""Build the French site (/fr/) from the English pages.

The English pages are the source of truth. This script copies each one to
its French address, translates every text node, label and meta tag with the
dictionary in _tools/fr.json, points internal links to the French pages,
and adds hreflang alternates and the EN / FR switch on both versions.

Run from the repository root after changing an English page:

    python3 _tools/build-fr.py
    python3 _tools/version-assets.py

Text that has no translation is listed at the end so nothing ships in
English by accident. Jekyll does not publish the _tools folder.
"""
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = 'https://satprod.net'

# English path -> French path
PAGES = {
    '/': '/fr/',
    '/services/': '/fr/services/',
    '/work/': '/fr/realisations/',
    '/about/': '/fr/a-propos/',
    '/contact/': '/fr/contact/',
    '/legal/': '/fr/mentions-legales/',
    '/privacy/': '/fr/confidentialite/',
}

FR = json.loads((ROOT / '_tools' / 'fr.json').read_text(encoding='utf-8'))
TEXT = FR['text']
KEEP = set(FR['keep'])


def src_file(path):
    return ROOT / path.strip('/') / 'index.html' if path != '/' else ROOT / 'index.html'


def alternates(en, fr):
    return (f'<link rel="alternate" hreflang="en" href="{SITE}{en}">\n'
            f'  <link rel="alternate" hreflang="fr" href="{SITE}{fr}">\n'
            f'  <link rel="alternate" hreflang="x-default" href="{SITE}{en}">')


def switch(href, code, name):
    return (f'<a class="lang-switch" href="{href}" hreflang="{code}" lang="{code}" '
            f'title="{name}">{code.upper()}</a>')


def add_head_and_switch(s, en, fr, current):
    # hreflang alternates, once, right after the canonical link
    s = re.sub(r'\n  <link rel="alternate" hreflang="[^"]*" href="[^"]*">', '', s)
    s = re.sub(r'(<link rel="canonical" href="[^"]*">)', lambda m: m.group(1) + '\n  ' + alternates(en, fr), s, count=1)
    # language switch in the header, before the theme toggle
    s = re.sub(r'<a class="lang-switch"[^>]*>[^<]*</a>\s*', '', s)
    target = switch(fr, 'fr', 'Version française') if current == 'en' else switch(en, 'en', 'English version')
    s = s.replace('<button class="icon-btn theme-toggle"', target + '\n          <button class="icon-btn theme-toggle"', 1)
    return s


def translate_text_nodes(s, missing):
    parts = re.split(r'(<[^>]+>)', s)
    skip = 0
    for i, part in enumerate(parts):
        if part.startswith('<'):
            tag = re.match(r'</?\s*([a-zA-Z0-9]+)', part)
            name = tag.group(1).lower() if tag else ''
            if name in ('script', 'style'):
                skip += -1 if part.startswith('</') else 1
            parts[i] = translate_attributes(part, missing)
            continue
        if skip or not part.strip():
            continue
        core = html.unescape(part.strip())
        lead = part[:len(part) - len(part.lstrip())]
        trail = part[len(part.rstrip()):]
        if core in TEXT:
            parts[i] = lead + html.escape(TEXT[core], quote=False) + trail
        elif core not in KEEP and re.search(r'[A-Za-z]{3,}', core):
            missing.add(core)
    return ''.join(parts)


def translate_attributes(tag, missing):
    def repl(m):
        attr, value = m.group(1), m.group(2)
        core = html.unescape(value)
        if core in TEXT:
            return f'{attr}="{html.escape(TEXT[core])}"'
        if core not in KEEP and re.search(r'[A-Za-z]{3,}', core):
            missing.add(f'@{attr}: {core}')
        return m.group(0)
    if tag.startswith('<meta'):
        if re.search(r'(name="description"|property="og:(title|description|image:alt)")', tag):
            return re.sub(r'(content)="([^"]*)"', repl, tag)
        return tag
    return re.sub(r'\b(aria-label|alt|title|placeholder|data-sending|data-error)="([^"]*)"', repl, tag)


def localise_links(s):
    def repl(m):
        path, query, frag = m.group(2), m.group(3) or '', m.group(4) or ''
        return f'{m.group(1)}"{PAGES.get(path, path)}{query}{frag}"'
    s = re.sub(r'(href=)"(/[a-z/-]*/|/)(\?[^"#]*)?(#[^"]*)?"', repl, s)
    return s


def build():
    missing_all = {}
    for en, fr in PAGES.items():
        source = src_file(en)
        s = source.read_text(encoding='utf-8')
        s = re.sub(r'<a class="lang-switch"[^>]*>[^<]*</a>\s*', '', s)
        # English page: alternates and switch
        source.write_text(add_head_and_switch(s, en, fr, 'en'), encoding='utf-8')

        t = s
        t = t.replace('<html lang="en"', '<html lang="fr-BE"', 1)
        t = t.replace(f'<link rel="canonical" href="{SITE}{en}">', f'<link rel="canonical" href="{SITE}{fr}">')
        t = t.replace(f'<meta property="og:url" content="{SITE}{en}">', f'<meta property="og:url" content="{SITE}{fr}">')
        t = t.replace('<meta property="og:locale" content="en_GB">', '<meta property="og:locale" content="fr_BE">\n  <meta property="og:locale:alternate" content="en_GB">')
        t = t.replace('/assets/images/og-image.png', '/assets/images/og-image-fr.png')
        for a, b in FR['raw']:
            t = t.replace(a, b)
        missing = set()
        t = translate_text_nodes(t, missing)
        t = localise_links(t)
        t = add_head_and_switch(t, en, fr, 'fr')
        t = translate_json_ld(t)
        out = ROOT / fr.strip('/') / 'index.html'
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(t, encoding='utf-8')
        if missing:
            missing_all[fr] = sorted(missing)
    if missing_all:
        print('Untranslated text:')
        for page, items in missing_all.items():
            for item in items:
                print(f'  {page}: {item}')
        sys.exit(1)
    print('French site built:', ', '.join(PAGES.values()))


def translate_json_ld(t):
    m = re.search(r'<script type="application/ld\+json">(.*?)</script>', t, re.S)
    if not m:
        return t
    data = json.loads(m.group(1))
    for node in data.get('@graph', [data]):
        if node.get('@type') == 'WebSite':
            node['@id'] = f'{SITE}/fr/#website'
            node['url'] = f'{SITE}/fr/'
            node['inLanguage'] = 'fr-BE'
        if node.get('@type') == 'Organization':
            node['description'] = FR['org_description']
            node['image'] = f'{SITE}/assets/images/og-image-fr.png'
    return t.replace(m.group(1), '\n' + json.dumps(data, ensure_ascii=False, indent=2) + '\n  ')


if __name__ == '__main__':
    build()
