# 08 — Design system

## 1. Direction: **Motorway**

The brief is a link that has been diverted through a toll gate. The subject's own world is
therefore *transit*: routes, exits, checkpoints, and the sign that tells you where you are
actually going. Clearway's visual language is taken from **motorway signage** — the most
functional graphic system ever built for telling a person the destination at a glance.

This is a deliberate rejection of the two obvious directions for this category: the
neon-on-black "hacker" look (every bypass site already looks like that) and the generic SaaS
gradient. Signage is the correct metaphor, and it happens to be nothing like either.

What that means concretely:

- High-contrast, unmissable hierarchy. A sign has one job at 70 mph.
- Geometric, not decorative. Every rule, marker, and divider encodes a real thing.
- Green means *through route*. Amber means *gate ahead*. These are not arbitrary brand colours.
- Wide, confident type with generous tracking on labels, the way signage sets its legends.

### The signature: the route strip

The single memorable element, and the thing that answers the competitive analysis's biggest
finding — that the category shows you a URL but never shows you what happened.

A resolution is rendered as a **road**: a horizontal lane with a dashed centre line. Each hop
is an exit marker along it, numbered in order, labelled with the host and the adapter that
handled it. The lane fills left to right as the resolve progresses, and terminates in a
green destination sign — the same shape as a real motorway exit sign — carrying the final URL.

```
   ①────────────②────────────③              ┌──────────────────────┐
   bit.ly       tracker      pastebin  ───▶  │  ▸ example.com       │
   301          query-param  raw            │    /downloads/b.zip  │
 ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌      └──────────────────────┘
```

Numbered markers are justified here, and only here: hops are a genuine ordered sequence and
the number carries information the reader needs. They appear nowhere else in the product.

Everything else stays quiet. One bold idea, executed properly.

## 2. Colour

Defined once in `src/app/globals.css` under Tailwind v4's `@theme`, consumed as utilities and
as raw `var()`.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--color-road` | `#0F1613` | `#0F1613` | Ink. Body text on light, surface on dark |
| `--color-road-2` | `#1B2621` | `#182320` | Raised surface on dark, deep borders on light |
| `--color-sign` | `#00693E` | `#22C07A` | Primary. Through-route green. Buttons, success, destination sign |
| `--color-sign-ink` | `#F4F7F2` | `#07130D` | Text on `--color-sign` |
| `--color-reflect` | `#F3F4EF` | `#EAEEE8` | Page background on light, text on dark |
| `--color-surface` | `#FFFFFF` | `#141D19` | Cards, inputs |
| `--color-amber` | `#C77A0A` | `#E8A33D` | Gate ahead. Warnings, degraded, partial results |
| `--color-route` | `#134FA8` | `#5B9BFF` | Route markers, links, informational |
| `--color-stop` | `#B3261E` | `#FF6B5E` | Errors, down state |
| `--color-line` | `#D3D7CE` | `#2A3833` | Hairlines, lane markings, dividers |
| `--color-muted` | `#5C665F` | `#8FA096` | Secondary text, captions |

Contrast: every foreground/background pair in the table meets WCAG 2.2 AA at its intended
size, and body text pairs meet AAA. `--color-amber` on `--color-surface` is used at ≥ 16 px
semibold only, where 4.5:1 holds.

**Dark mode** is the `.dark` class on `<html>`, driven by a pre-hydration inline script that
reads `localStorage` then `prefers-color-scheme`. No flash, no layout shift.

Semantic aliases (`--color-success`, `--color-warning`, `--color-danger`) map onto sign/amber/
stop, so component code never reaches for a raw hue.

## 3. Typography

Three faces, three jobs. Loaded through `next/font/google`, self-hosted at build, subset to
latin, `display: swap`.

| Role | Face | Why this one |
|---|---|---|
| Display | **Archivo** (600/700/800) | A grotesque with genuine signage DNA — high x-height, tight apertures, and a width axis that holds up at poster sizes. Reads as infrastructure, not as a startup |
| Body | **Public Sans** | Designed for a government design system: legible, plain-spoken, neutral without being Inter. Pairs with Archivo because they share a skeleton but differ clearly in voice |
| Data | **IBM Plex Mono** (400/500) | URLs, hosts, status codes, request IDs, session IDs. Monospace is not decoration here — a URL is data and must be scannable character by character |

### Scale

A 1.25 (major third) scale on a 16 px base, with display sizes fluid via `clamp()`.

| Token | Size | Line height | Tracking | Face | Use |
|---|---|---|---|---|---|
| `display` | `clamp(2.75rem, 7vw, 5.25rem)` | 0.94 | `-0.03em` | Archivo 800 | The hero. One per page |
| `h1` | `clamp(2rem, 4vw, 3rem)` | 1.05 | `-0.02em` | Archivo 700 | Page titles |
| `h2` | `1.75rem` | 1.15 | `-0.015em` | Archivo 700 | Section heads |
| `h3` | `1.25rem` | 1.3 | `-0.01em` | Archivo 600 | Card heads |
| `body` | `1rem` | 1.6 | `0` | Public Sans 400 | Prose |
| `small` | `0.875rem` | 1.5 | `0` | Public Sans 400 | Secondary |
| `label` | `0.75rem` | 1.2 | `0.14em` uppercase | Archivo 700 | Eyebrows, sign legends, table heads |
| `mono` | `0.9375rem` | 1.5 | `-0.01em` | IBM Plex Mono 400 | URLs and data |

The `label` treatment — small, wide-tracked, uppercase Archivo — is the signage legend, and it
is what ties the pages together. It is used for eyebrows, category labels, table headers, and
the lane markers, and nowhere else.

## 4. Layout

- **Grid.** 12 columns, 24 px gutters, `max-width: 1200px`. Content prose caps at 68ch.
- **Spacing.** 4 px base: `4 8 12 16 24 32 48 64 96 128`. Nothing off-scale.
- **Radius.** `--radius-sm: 4px`, `--radius: 8px`, `--radius-lg: 14px`. Signage is rectilinear;
  radii stay tight. The destination sign uses `--radius-lg` and is the only soft shape.
- **Borders.** 1 px `--color-line` hairlines by default. The destination sign gets a 2 px
  `--color-sign` border — a real sign has a border, and it is the only place we double up.
- **Elevation.** Two shadows only: `--shadow-sm` for cards, `--shadow-lg` for the result panel.
  Signage does not float.

### Breakpoints

`sm 640` · `md 768` · `lg 1024` · `xl 1280`. Mobile first. The route strip rotates to a
vertical timeline below `md` — the same information, the correct orientation for a phone.

## 5. Motion

Motion serves one purpose here: making the resolve legible while it happens.

| Moment | Treatment |
|---|---|
| Route strip during resolve | Lane fills left→right, 400 ms per hop, `cubic-bezier(.22,.61,.36,1)`. Each marker snaps in as its hop completes |
| Result panel entry | 240 ms fade + 8 px rise |
| Button press | 80 ms scale to 0.98 |
| Copy confirmation | Icon swap, 160 ms, plus a live-region announcement |
| Hover on interactive elements | 120 ms colour only. No transforms, no lifts |

`prefers-reduced-motion: reduce` disables all transitions and transforms globally; the route
strip renders in its final state immediately. Nothing is communicated by motion alone.

There is no scroll-jacking, no parallax, and no ambient animation. The page is a tool.

## 6. Components

| Component | Notes |
|---|---|
| `Button` | `primary` (sign green), `secondary` (outline), `ghost`. `sm`/`md`/`lg`. Loading state keeps the label and adds a spinner — never a width jump |
| `Input` | 56 px tall on the hero so it is a comfortable mobile tap target. Mono face, because the content is a URL. Inline error below, `aria-describedby` wired |
| `Card` | Surface, hairline, `--radius`. One padding scale |
| `Badge` | Status pill: operational/degraded/down/unavailable. Colour **and** a text label — never colour alone |
| `RouteStrip` | The signature. See §1 |
| `DestinationSign` | The green result panel. Host emphasised, path muted, copy and open actions |
| `ServiceCard` | Name, category label, domains in mono, status badge |
| `Tabs` | Category filter on `/supported`. Roving tabindex, arrow-key navigation |
| `CopyButton` | Clipboard write, 2 s confirmed state, `aria-live="polite"` announcement |
| `ThemeToggle` | Three-state: system / light / dark. Reflects the actual resolved state |

## 7. Accessibility floor

Non-negotiable, verified in CI:

- Every interactive element reachable and operable by keyboard, in DOM order.
- Focus visible everywhere: 2 px `--color-route` outline at 2 px offset. Never removed.
- Resolve results announced through `role="status" aria-live="polite"`; errors through
  `role="alert"`.
- The form's pending state announced, not just spun.
- Status conveyed by text and shape, never by colour alone.
- Landmarks on every page: `header`/`nav`/`main`/`footer`, one `h1`, no skipped levels.
- A skip link to `#main` as the first focusable element.
- `prefers-reduced-motion` honoured.
- Zoom to 200% without horizontal scroll or clipping.
- All images decorative-or-described; icon-only buttons carry `aria-label`.

## 8. Voice

Written from the user's side of the screen.

| Do | Don't |
|---|---|
| "Paste a link" | "Enter URL to initiate bypass" |
| "Copied" after "Copy" | "Copy" → "Success!" |
| "That host is blocked. Private and internal addresses can't be resolved." | "Error: SSRF validation failed" |
| "No adapter handles this link yet. Tell us about it and we'll look." | "Unsupported" |
| "Nothing here yet. Resolve a link and it'll show up." | "No data available" |

Sentence case throughout except the `label` treatment. Active voice. The button that says
"Resolve link" produces a result panel headed "Resolved" — the same word all the way through
the flow.

Errors state what happened and what to do next. They do not apologise and they are never vague.
Empty states are an invitation to act.

## 9. Implementation

Tokens live in `src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-road:    #0F1613;
  --color-sign:    #00693E;
  --color-reflect: #F3F4EF;
  --color-amber:   #C77A0A;
  --color-route:   #134FA8;
  /* … */
  --font-display: var(--font-archivo), ui-sans-serif, system-ui, sans-serif;
  --font-sans:    var(--font-public-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono:    var(--font-plex-mono), ui-monospace, monospace;
}
```

Dark values are re-declared under `.dark` as plain custom properties, so every Tailwind
utility built on a token flips automatically with no `dark:` variant in component code. A
component that needs an explicit `dark:` variant is a signal the token set is missing something.
