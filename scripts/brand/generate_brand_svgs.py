#!/usr/bin/env python3
"""
Generates the ArchMind logo system as self-contained SVG (text converted to outlines).

  pip install fonttools
  curl -L -o /tmp/Manrope.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/Manrope%5Bwght%5D.ttf"
  python3 scripts/brand/generate_brand_svgs.py /tmp/Manrope.ttf
  node scripts/brand/rasterize.js            # PNG / ICO derivatives (needs sharp)

Symbol: a bundle of flowing lines forming an architectural arch / wave (architecture +
flow + intelligence), rendered in the brand gradient #2563EB → #06B6D4 → #14B8A6.
Wordmark: "ArchMind" (Manrope 700) dominant, "WORKS" (Manrope 600, wide tracking) secondary.
"""
import os
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'brand')

NAVY = '#081F3B'
BLUE = '#2563EB'
BLUE_ON_DARK = '#3B82F6'
WHITE = '#FFFFFF'

# ── Symbol ─────────────────────────────────────────────────────────────────
SYMBOL_W, SYMBOL_H = 200, 110


def symbol_paths(n=13):
    """Line i: the lines start fanned along the base at the left, rise as a wide ribbon,
    bunch into a crest right of centre, then fall to the right base, spreading again."""
    paths = []
    for i in range(n):
        t = i / (n - 1)
        p0 = (2 + 40 * t, 104)
        c1 = (44 + 30 * t, 100 - 2 * t)
        c2 = (76 + 30 * t, 4 + 32 * t)
        p1 = (122 + 12 * t, 3 + 44 * t)
        c4 = (184 - 6 * t, 62 + 10 * t)
        p2 = (198 - 20 * t, 104)
        f = lambda p: f'{p[0]:.2f} {p[1]:.2f}'
        paths.append(f'M{f(p0)} C{f(c1)} {f(c2)} {f(p1)} S{f(c4)} {f(p2)}')
    return paths


def symbol_group(fill_mode, gid, n=13, stroke=1.45, tx=0, ty=0, scale=1.0):
    """fill_mode: 'gradient' | hex colour."""
    defs = ''
    if fill_mode == 'gradient':
        defs = (f'<linearGradient id="{gid}" x1="0" y1="104" x2="200" y2="10" gradientUnits="userSpaceOnUse">'
                f'<stop offset="0" stop-color="#2563EB"/><stop offset="0.6" stop-color="#06B6D4"/><stop offset="1" stop-color="#14B8A6"/></linearGradient>')
        stroke_ref = f'url(#{gid})'
    else:
        stroke_ref = fill_mode
    body = ''.join(f'<path d="{d}"/>' for d in symbol_paths(n))
    g = (f'<g transform="translate({tx:.2f} {ty:.2f}) scale({scale:.4f})" fill="none" stroke="{stroke_ref}" '
         f'stroke-width="{stroke}" stroke-linecap="round" stroke-linejoin="round">{body}</g>')
    return defs, g


# ── Wordmark (outlined text) ───────────────────────────────────────────────
class Face:
    def __init__(self, path, weight):
        font = TTFont(path)
        self.font = instantiateVariableFont(font, {'wght': weight})
        self.gs = self.font.getGlyphSet()
        self.cmap = self.font.getBestCmap()
        self.upm = self.font['head'].unitsPerEm
        self.cap = self.font['OS/2'].sCapHeight

    def text(self, s, size, x, y, tracking_em=0.0):
        """Returns (svg path d, advance width) for s at font size `size`, baseline (x, y)."""
        k = size / self.upm
        pen = SVGPathPen(self.gs)
        cursor = 0.0
        for ch in s:
            name = self.cmap[ord(ch)]
            glyph = self.gs[name]
            glyph.draw(TransformPen(pen, (k, 0, 0, -k, x + cursor, y)))
            cursor += glyph.width * k + tracking_em * size
        cursor -= tracking_em * size
        return pen.getCommands(), cursor


def svg_doc(w, h, defs, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.2f} {h:.2f}" width="{w:.0f}" height="{h:.0f}" role="img" aria-label="{title}">'
            f'<title>{title}</title>' + (f'<defs>{defs}</defs>' if defs else '') + body + '</svg>')


TONES = {
    # tone: (symbol, ArchMind, WORKS)
    'color': ('gradient', NAVY, BLUE),         # light backgrounds
    'reverse': ('gradient', WHITE, BLUE_ON_DARK),  # dark backgrounds, full colour symbol
    'white': (WHITE, WHITE, WHITE),            # monochrome on dark
    'dark': (NAVY, NAVY, NAVY),                # monochrome on light
}


def lockups(bold, semi):
    files = {}
    for tone, (sym, word, works) in TONES.items():
        gid = f'am-g-{tone}'
        # Horizontal: symbol | ArchMind over WORKS
        sym_h = 98.0
        s = sym_h / SYMBOL_H
        sym_w = SYMBOL_W * s
        gap = 22
        name_d, name_w = bold.text('ArchMind', 66, 0, 0, -0.012)
        works_size = 20
        _, works_w = semi.text('WORKS', works_size, 0, 0, 0.55)
        tx = sym_w + gap
        name_d, name_w = bold.text('ArchMind', 66, tx, 60, -0.012)
        works_d, works_w = semi.text('WORKS', works_size, tx + (name_w - works_w) / 2, 94, 0.55)
        defs, g = symbol_group(sym, gid, stroke=2.1, tx=0, ty=0, scale=s)
        w = tx + name_w + 2
        files[f'archmind-horizontal-{tone}.svg'] = svg_doc(w, sym_h, defs, g + f'<path fill="{word}" d="{name_d}"/><path fill="{works}" d="{works_d}"/>', 'ArchMind WORKS')

        # Stacked: symbol above, ArchMind, WORKS
        name_d0, name_w = bold.text('ArchMind', 66, 0, 0, -0.012)
        total_w = name_w + 4
        s2 = (total_w * 0.62) / SYMBOL_W
        sym_h2 = SYMBOL_H * s2
        defs2, g2 = symbol_group(sym, gid + 's', stroke=1.8, tx=(total_w - SYMBOL_W * s2) / 2, ty=0, scale=s2)
        base = sym_h2 + 10 + 48
        name_d2, _ = bold.text('ArchMind', 66, 2, base, -0.012)
        works_d2, _ = semi.text('WORKS', works_size, (total_w - works_w) / 2, base + 34, 0.55)
        files[f'archmind-stacked-{tone}.svg'] = svg_doc(total_w, base + 38, defs2, g2 + f'<path fill="{word}" d="{name_d2}"/><path fill="{works}" d="{works_d2}"/>', 'ArchMind WORKS')

        # Symbol only
        defs3, g3 = symbol_group(sym, gid + 'y')
        files[f'archmind-symbol-{tone}.svg'] = svg_doc(SYMBOL_W, SYMBOL_H, defs3, g3, 'ArchMind')
    return files


def app_icon(size_px, simplified):
    """Rounded-square app icon / favicon: navy field + symbol."""
    n, stroke = (7, 4.6) if simplified else (13, 2.0)
    s = 0.74 * 512 / SYMBOL_W
    tx = (512 - SYMBOL_W * s) / 2
    ty = (512 - SYMBOL_H * s) / 2 + 8
    defs, g = symbol_group('gradient', 'am-icon-g', n=n, stroke=stroke, tx=tx, ty=ty, scale=s)
    bg = ('<linearGradient id="am-icon-bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">'
          '<stop offset="0" stop-color="#0D2B50"/><stop offset="1" stop-color="#061528"/></linearGradient>')
    body = '<rect width="512" height="512" rx="112" fill="url(#am-icon-bg)"/>' + g
    return svg_doc(512, 512, defs + bg, body, 'ArchMind')


def social_card(bold, semi, reg):
    W, H = 1200, 630
    bg = ('<linearGradient id="am-bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">'
          '<stop offset="0" stop-color="#0A2547"/><stop offset="0.55" stop-color="#081F3B"/><stop offset="1" stop-color="#061528"/></linearGradient>')
    # faint large symbol as backdrop on the right
    d_back, g_back = symbol_group('gradient', 'am-back', n=18, stroke=1.2, tx=560, ty=150, scale=3.4)
    s = 300 / SYMBOL_W
    d_sym, g_sym = symbol_group('gradient', 'am-sym', tx=(W - SYMBOL_W * s) / 2, ty=110, scale=s)
    name_d, name_w = bold.text('ArchMind', 112, 0, 0, -0.012)
    name_d, _ = bold.text('ArchMind', 112, (W - name_w) / 2, 380, -0.012)
    _, works_w = semi.text('WORKS', 28, 0, 0, 0.62)
    works_d, _ = semi.text('WORKS', 28, (W - works_w) / 2, 432, 0.62)
    _, tag_w = reg.text('ARCHITECTURE TODAY. A SMARTER TOMORROW.', 20, 0, 0, 0.32)
    tag_d, _ = reg.text('ARCHITECTURE TODAY. A SMARTER TOMORROW.', 20, (W - tag_w) / 2, 520, 0.32)
    body = (f'<rect width="{W}" height="{H}" fill="url(#am-bg)"/><g opacity="0.16">{g_back}</g>{g_sym}'
            f'<path fill="#FFFFFF" d="{name_d}"/><path fill="{BLUE_ON_DARK}" d="{works_d}"/><path fill="#C5D3E8" d="{tag_d}"/>')
    return svg_doc(W, H, bg + d_back + d_sym, body, 'ArchMind — Architecture today. A smarter tomorrow.')


def main(font_path):
    bold, semi, reg = Face(font_path, 700), Face(font_path, 600), Face(font_path, 500)
    os.makedirs(os.path.join(OUT, 'logos'), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'icons'), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'social'), exist_ok=True)
    for name, svg in lockups(bold, semi).items():
        open(os.path.join(OUT, 'logos', name), 'w').write(svg)
    open(os.path.join(OUT, 'icons', 'app-icon.svg'), 'w').write(app_icon(512, simplified=False))
    open(os.path.join(OUT, 'icons', 'app-icon-small.svg'), 'w').write(app_icon(512, simplified=True))
    open(os.path.join(ROOT, 'public', 'favicon.svg'), 'w').write(app_icon(512, simplified=True))
    open(os.path.join(OUT, 'social', 'archmind-og.svg'), 'w').write(social_card(bold, semi, reg))
    print('SVG assets written to', OUT)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '/tmp/Manrope.ttf')
