# ArchMind brand system (public portal)

The public portal consists of the landing page (`/` on archmindworks.com) and the entry pages
(`/login`, `/register`, `/invite/:token`, `/shared/:token`). Its brand system lives here and nowhere else.

| File | Purpose |
|---|---|
| `tokens.css` | Design tokens: colours, gradients, typography, spacing, radius, shadows, borders, layout, motion. Everything else consumes these. |
| `brand.css` | `.am-*` primitives built only on the tokens: typography, eyebrow and section header, buttons, cards, icon tile, logo, pattern, form fields, utilities. |
| `assets.ts` | Registry of the approved logo files, plus the brand names (`ArchMind`, descriptor `WORKS`, legal name `ArchMindWorks`). |
| `BrandLogo.tsx` | The logo component. Variants: horizontal, stacked, symbol. Tones: color, white, dark. Clear space is built in. |
| `BrandPattern.tsx` | Supporting pattern: `flow` draws layered architectural contours; `topology` draws connected capability nodes. It is decorative and never replaces the logo. |
| `icons.tsx` | The single outline icon family: 24px grid, 1.75 stroke. |

## Rules

- **Brand hierarchy.** ArchMind is always dominant and WORKS is secondary. Use `ArchMindWorks` only where the legal name is required, such as the copyright line.
- **Colour.** Use Primary Blue `#2563EB` for actions and links, and Navy `#081F3B` for dark surfaces. Cyan `#06B6D4` and teal `#14B8A6` are accents only.
- **Gradients.** Use `--am-gradient` for decorative accents. Use `--am-gradient-action` only for the single most important call to action in a view; its white text stays at or above 4.5:1 end to end.
- **Typography.** Latin text uses Manrope. Arabic text uses IBM Plex Sans Arabic, and Arabic headings have no negative tracking.
- **Motion.** Every duration becomes 0 under `prefers-reduced-motion`.

## Logo assets

The logo system was produced from the approved concept board. The masters are vector files, and the wordmark
text is converted to outlines, so each file renders identically in `<img>`, email and print. Everything is
generated, so changes are made in the generator rather than by editing individual files:

```bash
pip install fonttools
curl -L -o /tmp/Manrope.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/Manrope%5Bwght%5D.ttf"
python3 scripts/brand/generate_brand_svgs.py /tmp/Manrope.ttf     # all SVG masters
npm i --no-save sharp && node scripts/brand/rasterize.js         # PNG / ICO derivatives
```

**Lockups.** Files are in `public/brand/logos/` and are all registered in `assets.ts`. Each is named
`archmind-{horizontal|stacked|symbol}-{color|reverse|white|dark}.svg`, where the tone means:

- `color`: full colour, for light backgrounds.
- `reverse`: full-colour symbol with a white wordmark, for navy backgrounds. The header and footer use this.
- `white` and `dark`: monochrome versions.

**Favicons.**
- `public/favicon.svg`
- `public/favicon.ico` (16, 32 and 48)
- `brand/icons/favicon-{16,32,48}.png`

**App and PWA icons.** `brand/icons/icon-{72,96,128,144,152,192,256,384,512,1024}.png`. Sizes below 72px use a
simplified symbol with fewer, heavier lines so they stay legible.

**Apple touch icon.** `public/apple-touch-icon.png` (180×180).

**Social.**
- `brand/social/archmind-og-1200x630.png`, referenced by `og:image` and `twitter:image`.
- `archmind-profile-1024.png`, for profile images.
- `archmind-og.svg`, the vector master.

**Usage.**
- `--am-logo-size` on `BrandLogo` is the cap height of "ArchMind", and image heights follow from it.
- Keep at least the height of the "A" as clear space around the logo. `BrandLogo` builds this in.
- The minimum on-screen width for the horizontal lockup is 113px.
- Never recolour, stretch, rotate or add effects to the logo.
