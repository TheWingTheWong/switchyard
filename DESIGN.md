# SWITCHYARD design system: "Inspection certificate"

The visual world is the EN 10204 3.1 inspection certificate that comes with every part of a train: security-paper ground, ruled form fields, blue-black ink figures, and an inspector's violet stamp that makes a result official. It suits a decision room where every number must be traceable and the final output is a document that someone signs.

Mode: **Operate**. The world provides only type, palette, density and one signature move. Navigation, tables, buttons and inputs stay standard web controls.

## Scene

A rail procurement buyer at a desktop screen in office daylight. Long sessions, dense tables, and a memo printed to PDF at the end. That scene calls for a light theme. The demo is recorded at 1440×900 with 110% zoom and the chat panel open, so the main column is about 900 CSS px. Every screen is laid out for that width using container queries (`@container` on `<main>`).

## Tokens (all in `app/globals.css`)

| Role | Token | Value |
|---|---|---|
| Ground (security paper) | `--bg` | `#e9ede8` |
| Work surface (form stock) | `--sheet` | `#fbfcfa` |
| Recessed / selected | `--surface` | `#f1f4f0` |
| Ink | `--fg` | `#151a2c` |
| Secondary ink | `--muted` | `#535a6b` |
| Hairline seam | `--line` | `#cfd6cf` |
| Stamp ink (actions, shell, verdicts) | `--stamp` / `--stamp-deep` / `--stamp-tint` | `#3a2c9c` / `#211a5e` / `#e4e1f5` |
| Risk Low / Medium / High / Critical | `--risk-*` + `--risk-*-fg` | sage / ochre / orange / red `#ad2018` |

Colour strategy: a committed shell (stamp-deep header band) on tinted neutrals. Stamp ink is the only action colour. Risk colours appear only where they carry a level.

**Risk rule:** colour is never alone. `LevelTag` always prints the level word. Critical is also hatched (`.hatch-critical`) and bold in the heatmap, and the Compare key lists the ranges.

## Type

- **Archivo** (variable, with a width axis), loaded in `components/fonts.ts`. Body text uses normal width. The certificate's field captions use `.cap`, at 82% width, uppercase, 11px. Headings use `.display`, at 78% width, bold, with tight leading.
- **JetBrains Mono** (`.num`) for every figure, ID and score, with tabular numerals.

## Surfaces

- `.sheet` / `.card`: form stock with a 1px seam and 2px radius. No shadows anywhere.
- `.field-grid`: a ruled block of fields separated by 1px seams (KPI strip, memo header, supplier facts).
- `.guilloche`: a thin security-print band on top of the "document" sheets (supplier to replace, decision memo).
- `.tbl`: an ink-ruled header and hairline rows. `.is-current` uses the stamp tint and `.is-listed` the surface tint.

## Signature move: the inspector's stamp

`components/Stamp.tsx` is an SVG double-ring rubber stamp in stamp ink, with ring text and a centre band. It appears only where a verdict is recorded:

- **Challenge:** CHALLENGED (red ink) or HOLDS, with the number of failed checks.
- **Verify:** EVIDENCE, marked cached replay or live run, with the source count in the ring.
- **Decide:** CANDIDATE FOR QUALIFICATION on the memo. It prints.

The stamp's text always states its meaning. Its one authored motion is a 320ms press (scale and blur settling, ease-out), which is disabled under `prefers-reduced-motion` and in print. All other motion is limited to button colour transitions. Recharts animation stays off.

## Shell

A stamp-deep header band holds a turnout mark (one track diverging into two), the SWITCHYARD wordmark, the six steps with circular check marks, and live context (replace / shortlist / pick). Each page header puts its step number in a ruled box beside the question that step answers. There are no eyebrow labels.

## Don'ts

- No colour-only encodings, gradient text, glass, or card shadows.
- No new accent hues. Anything that acts uses stamp ink.
- Don't change button labels; VIDEO.md and the click-through test depend on them.
