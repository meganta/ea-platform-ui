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

## Logo assets: action required from design

Only the brand board image has been supplied. It is a presentation board, not a production asset, and the approved
symbol must not be redrawn. Until vector files arrive, `BrandLogo` renders the brand name as accessible text in the
approved hierarchy, with no symbol.

Export these from the vector master into `public/brand/logos/` and register each one in `assets.ts`:

- `archmind-horizontal-color.svg`, `archmind-horizontal-white.svg`, `archmind-horizontal-dark.svg`
- `archmind-stacked-color.svg`, `archmind-stacked-white.svg`, `archmind-stacked-dark.svg`
- `archmind-symbol-color.svg`, `archmind-symbol-white.svg`, `archmind-symbol-dark.svg`

Once the symbol is available, add these to `public/` and reference them from `index.html` and `manifest.json`:

- `favicon.ico` (16/32/48)
- `favicon.svg`
- `apple-touch-icon.png` (180)
- `icon-72.png` through `icon-512.png`: 72, 96, 128, 144, 152, 192, 384 and 512
- A 1200×630 social sharing image

Until then, the existing favicon stays in place.
