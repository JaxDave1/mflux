# MFLUX Neural Interface — DESIGN_LOCK

**Status:** Locked v1.0 — Mirror Blue
**Supersedes:** `GLOBAL_DESIGN_THEME.md` (SYNTHETIX NOIR), all prior Stitch reference renders
**Authority:** This document is canonical. When this conflicts with a Stitch render, this wins. When this conflicts with Stitch content, this wins. When this conflicts with Stitch material treatment, the Stitch render may be consulted as reference but is never copied verbatim.

## 0. Lock Rules

1. No Stitch hallucinations ship. Fake model names, fake job counts, fake kernel logs, fake operational protocols, decorative gallery imagery, and invented controls are reference-only.
2. Layout, content, and nav order are frozen. This document defines the visual language for the existing structure.
3. Token changes require a lock revision before implementation.
4. Pass 2 reskins of the ten non-Dashboard modules consume this document directly.

## 1. Color Tokens

```css
--color-bg-deep: #001F3F;
--color-bg-lit: #002B55;
--color-surface-glass: rgba(0, 43, 85, 0.55);
--color-surface-recessed: rgba(0, 20, 40, 0.65);
--color-surface-rail: rgba(184, 201, 224, 0.04);
--color-edge-faint: rgba(184, 201, 224, 0.12);
--color-edge-strong: rgba(0, 212, 200, 0.35);
--color-edge-titanium: rgba(184, 201, 224, 0.25);
--color-accent-cyan: #00D4C8;
--color-accent-ai: #7C8CFF;
--color-metallic: #B8C9E0;
--color-text-primary: #FFFFFF;
--color-text-secondary: #A0B4D0;
--color-text-muted: rgba(160, 180, 208, 0.6);
--color-status-healthy: #00D4C8;
--color-status-warn: #FFB454;
--color-status-error: #FF4D6B;
```

Identity accents are never used as warning or error states.

## 2. Typography

```css
--font-display: "Rajdhani", "Eurostile", system-ui, sans-serif;
--font-body: "IBM Plex Sans", "Inter", -apple-system, sans-serif;
--font-mono: "IBM Plex Mono", ui-monospace, monospace;
```

| Role | Font | Size | Weight | Letter-spacing | Transform |
|---|---|---:|---:|---:|---|
| Brand | Rajdhani | 18px | 600 | 0.08em | uppercase |
| Page title | Rajdhani | 32px | 600 | 0.04em | uppercase |
| Section header | Rajdhani | 14px | 600 | 0.12em | uppercase |
| Card label | Rajdhani | 11px | 500 | 0.18em | uppercase |
| Card value | Rajdhani | 28px | 600 | 0.02em | uppercase |
| Body | IBM Plex Sans | 14px | 400 | 0 | none |
| Caption/readout | IBM Plex Sans | 12px | 400 | 0 | none |
| Mono | IBM Plex Mono | 12px | 400 | 0 | none |

Brushed titanium header treatment applies to the brand, page title, section headers, and card values only. It is not applied to body text, captions, status pills, or button labels.

```css
.titanium-text {
  background: linear-gradient(180deg, #FFFFFF 0%, #E8EEF5 35%, #B8C9E0 55%, #8A9BB5 75%, #C5D4E8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.08));
}
```

Do not use the treatment below 11px.

## 3. Spacing Scale

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

Card internal padding is 20px, card gaps are 16px, major section gaps are 32px, and shell padding is 24px horizontal by 16px vertical.

## 4. Radius Scale

```css
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
```

## 5. Material Treatments

The four zones must read as different materials at a glance.

1. Background lacquer: vertical gradient from `#001F3F` to `#002B55` with subtle scanline/grid texture. Never flat blue or crushed black.
2. Brushed titanium nav rail: integrated rail with faint directional grain, silver `#B8C9E0` edge, and cyan active state.
3. Smoked glass cards: top metrics and Recent Outputs use translucent blue-tinted glass with thin borders, internal highlight, and hover rim light.
4. Carbon-composite telemetry: Resources panel uses recessed dark composite with subtle weave and inset shadow.
5. Anodized metal quick actions: raised, beveled controls with top highlight, bottom shadow, and faint cyan rest glow.

## 6. Header Band

The fixed header uses translucent lacquer, increased opacity, and backdrop blur so underlying content does not show through as legible ghost text.

```css
.app-header {
  background: rgba(0, 31, 63, 0.75);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  border-bottom: 1px solid var(--color-edge-faint);
}
```

## 7. Component Rules

Status pills use compact uppercase Rajdhani, semantic colors, and a glowing dot. Progress bars use solid cyan fills only, no gradients. Buttons use faint cyan fill, cyan border, and hover shadow rather than solid neon fills.

## 8. Iconography

Material Symbols are the source language, but implementation is inline SVG. The web-font load failure during smoke testing ratifies the local inline SVG path. Icons are stroke-only, use `currentColor`, and active/accent states use `#00D4C8`.

## 9. Motion

Default transition is `150ms cubic-bezier(0.4, 0, 0.2, 1)`. Quick action hover uses shadow expansion only, with no transform or scale. Data does not animate in. Reduced-motion disables transitions of 100ms or longer.

## 10. Loading And Long-Running Job UX

The full architecture lives in `LONG_RUNNING_JOB_UX.md`. Visually, module loading screens never show bare `Loading...` text; active jobs need module name, elapsed time, ETA, progress, and cancel control once the job system lands.

## 11. Do Not Ship

- Fake operational protocol strings
- Faux scrolling kernel logs
- Decorative Recent Outputs imagery
- Halt, Reset, or Sync controls
- Hardcoded generation counts
- Invented model names
- Hardcoded platform names
- New sci-fi copy beyond existing spec
- Extra charts beyond the four telemetry bars
- Solid neon button fills
- Plastic chrome typography
- Flat enterprise-white cards
- Pure black backgrounds
- Gradient progress fills
- Decorative imagery outside Gallery

## 12. Dashboard Implementation Checklist

- [x] Google Fonts import in `ui/index.html` for Rajdhani, IBM Plex Sans, and IBM Plex Mono
- [x] CSS custom properties from §1 added to `:root`
- [x] Body `font-family: var(--font-body)`
- [x] Page substrate uses lacquer gradient
- [x] Header band uses translucent backdrop blur
- [x] Nav rail uses brushed titanium treatment
- [x] Top metric cards use smoked glass treatment
- [x] Resources panel uses carbon-composite treatment
- [x] Quick action cards use anodized bevel treatment
- [x] Brand, page title, section headers, and card values use `.titanium-text`
- [x] Body and readouts remain clean white/secondary body text
- [x] Status pills use the locked pill treatment
- [x] Progress bars use solid cyan fills
- [x] All four zones are visually distinguishable at a glance
- [x] No items from §11 are present

## 13. Sign-Off

This document is ratified when Dashboard implements §12, review happens against this document rather than any Stitch render, the four material zones read distinctly, and none of §11 is present.

**Lock owner:** David Hendricks
**Drafted:** 2026-05-03
**Ratified:** 2026-05-04
