# CSS Design Tokens Reference

> BiocomAI SEO Intelligence Dashboard
> Updated: 2026-02-27

## CSS Custom Properties (globals.css :root)

### Colors

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#0D9488` | Primary teal, CTA, links |
| `--color-primary-light` | `#14b8a6` | Primary hover |
| `--color-primary-dark` | `#0f766e` | Primary dark variant |
| `--color-accent` | `#F59E0B` | Amber, warnings, opportunity |
| `--color-danger` | `#EF4444` | Red, errors, negative |
| `--color-success` | `#10B981` | Green, positive, good score |
| `--color-info` | `#3b82f6` | Blue, informational, GEO |

### Text

| Token | Value | Usage |
|---|---|---|
| `--color-text-primary` | `#0f172a` | Headings, body text |
| `--color-text-secondary` | `#475569` | Secondary labels |
| `--color-text-muted` | `#94a3b8` | Muted/tertiary text |

### Surfaces & Borders

| Token | Value | Usage |
|---|---|---|
| `--color-surface` | `#ffffff` | Card/panel background |
| `--color-surface-hover` | `#f8fafc` | Hover states |
| `--color-surface-alt` | `#f1f5f9` | Alternate surface |
| `--color-border` | `rgba(15,23,42,0.10)` | Light border |
| `--color-border-strong` | `rgba(15,23,42,0.12)` | Strong border |
| `--bg-main` | `#F8FAFB` | Page background |
| `--bg-accent` | `#f0f4f8` | Accent background |

### Navigation

| Token | Value | Usage |
|---|---|---|
| `--nav-bg` | `#0f172a` | Nav dark background |
| `--nav-text` | `#e2e8f0` | Nav text |
| `--nav-text-muted` | `#94a3b8` | Nav secondary text |
| `--nav-tab-active` | `#2dd4bf` | Active tab indicator |

---

## Spacing Scale

| Size | Value | Usage |
|---|---|---|
| xs | `4px` | Pill gap, tight spacing |
| sm | `8px` | Badge padding, inner gaps |
| md | `12px` | Default gap, card inner |
| lg | `16px` | Section gap |
| xl | `20px` | Card padding (standard) |
| 2xl | `24px` | Section padding, main grid gap |

---

## Border Radius

| Size | Value | Usage |
|---|---|---|
| sm | `6px` | Badges, small elements |
| md | `8px` | Buttons, inputs, tooltip |
| lg | `10px` | Summary cards |
| xl | `16px` | **Standard card radius** |
| round | `9999px` | Pill-shaped buttons |

**Convention**: All main cards use `border-radius: 16px; padding: 20px`.

---

## Font Sizes

| Token | Size | Usage |
|---|---|---|
| text-2xs | `0.65rem` | Badges, tiny labels |
| text-xs | `0.7rem` | Badges, table headers |
| text-sm | `0.75rem` | Definitions, small buttons |
| text-base | `0.8rem` | Body text |
| text-md | `0.85rem` | Section subtitles |
| text-lg | `1rem` | Card/chart titles |
| text-xl | `1.1rem` | Section titles |
| text-2xl | `1.3rem` | KPI values |
| text-3xl | `1.85rem` | Large KPI values |

### Font Weights

| Weight | Usage |
|---|---|
| `400` | Body text |
| `500` | Buttons, subtitles |
| `600` | Labels, badges, emphasis |
| `700` | Headings, titles |
| `800` | KPI hero values |

---

## Shadows

| Level | Value | Usage |
|---|---|---|
| light | `0 1px 3px rgba(0,0,0,0.06)` | Cards (default) |
| medium | `0 4px 12px rgba(0,0,0,0.08)` | Tooltips, dropdowns |
| hover | `0 6px 20px rgba(0,0,0,0.08)` | Card hover state |

---

## Transitions

| Speed | Duration | Usage |
|---|---|---|
| fast | `0.15s ease` | Button/hover interactions |
| normal | `0.2s ease` | General UI transitions |
| slow | `0.3s` | Progress bars, width changes |
| chart | `0.5s ease` | Chart data animations |

---

## Glassmorphism Pattern

```css
/* Navbar */
background: rgba(255, 255, 255, 0.82);
backdrop-filter: blur(12px);

/* Card overlay */
background: rgba(255, 255, 255, 0.72);
backdrop-filter: blur(8px);

/* Tooltip */
background: rgba(255, 255, 255, 0.95);
backdrop-filter: blur(8px);
```

---

## Chart Metric Colors

| Metric | Color | Usage |
|---|---|---|
| clicks | `#0D9488` | Click trend line |
| impressions | `#64748B` | Impression trend line |
| ctr | `#2563EB` | CTR trend line |
| position | `#F59E0B` | Position trend line |

### Score Bar Gradients

| Level | Gradient | Range |
|---|---|---|
| Good | `linear-gradient(90deg, #10b981, #34d399)` | >= 70% |
| Warning | `linear-gradient(90deg, #f59e0b, #fbbf24)` | 40-69% |
| Danger | `linear-gradient(90deg, #ef4444, #f87171)` | < 40% |

---

## AI Source Brand Colors

| Source | Background | Text |
|---|---|---|
| ChatGPT | `rgba(16,163,127,0.12)` | `#10A37F` |
| Perplexity | `rgba(90,103,216,0.12)` | `#5A67D8` |
| Gemini | `rgba(66,133,244,0.12)` | `#4285F4` |
| Claude | `rgba(217,119,6,0.12)` | `#D97706` |
| Copilot | `rgba(14,165,233,0.12)` | `#0EA5E9` |
| Bing | `rgba(0,120,212,0.12)` | `#0078D4` |

---

## CSS Module Files

| File | Scope |
|---|---|
| `globals.css` | CSS custom properties, base styles |
| `page.module.css` | Dashboard layout, cards, tables |
| `KpiCard.module.css` | KPI card component |
| `TrendChart.module.css` | Trend chart + compare overlay |
| `AiTraffic.module.css` | AI traffic analysis section |
| `DataTable.module.css` | Generic sortable data table |
| `OptimizationChecklist.module.css` | Optimization checklist panel |
| `IntentChart.module.css` | Intent analysis chart |
| `AiCitation.module.css` | AI citation diagnosis |
