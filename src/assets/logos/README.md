# Logos

Drop your brand SVGs here, keeping these exact file names so the app picks them
up automatically (they are imported in `src/components/Brand.tsx`):

- **`logo-mark.svg`** — the plain logo / isotype (no text). Used as the compact
  mark (e.g. favicon-style, tight spaces).
- **`logo-full.svg`** — the logo **with the company name** underneath. Used in
  the dashboard header.

Both must be **SVG**. The placeholders currently in this folder are safe to
overwrite. Recommended: transparent background, and let the SVG inherit sizing
(the header constrains height, width auto).
