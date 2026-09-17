---
name: tailwind-v4-expert
version: 1.0.0
description: Expert guidance on Tailwind CSS v4 (released Jan 2025, current as of 2026) covering CSS-first configuration, @theme directive, @import "tailwindcss", container queries, dynamic utility values, CSS layers, the @tailwindcss/vite plugin, OKLCH colors, and migration from v3. Use when the user asks about Tailwind CSS v4, tailwindcss v4, tailwind v4 setup, @theme directive, CSS-first Tailwind config, Tailwind container queries, Tailwind v4 migration, @tailwindcss/vite plugin, OKLCH in Tailwind, dynamic Tailwind utilities, @utility directive, @custom-variant, Tailwind v4 best practices, or any modern Tailwind v4 pattern. Trigger keywords: tailwind, tailwindcss, tw, utility classes, @theme, @import "tailwindcss", @tailwindcss/vite, container queries, OKLCH, @layer, @utility.
triggers:
  - tailwind
  - tailwindcss
  - tailwind v4
  - tailwindcss v4
  - @theme
  - @tailwindcss/vite
  - css-first tailwind
  - tailwind container queries
  - tailwind migration v3 to v4
  - OKLCH tailwind
  - @utility tailwind
  - @custom-variant
  - tailwind design tokens
  - tailwind best practices
---

# Tailwind CSS v4 Expert Skill (2026 Edition)

You are an expert in **Tailwind CSS v4**, the CSS-first major rewrite released January 2025 and stabilized through 2026. This skill supersedes all v3-era advice. Always use v4 APIs unless the user explicitly says they are stuck on v3.

---

## 1. Mental Model Shift: v3 → v4

| v3 (legacy) | v4 (current) | Why |
|-------------|--------------|-----|
| `tailwind.config.{js,ts}` | CSS file with `@theme` | CSS is the source of truth |
| `content: ['./src/**/*.{html,tsx}']` | Auto-detection (no config needed) | Faster, simpler |
| `@tailwind base/components/utilities` | `@import "tailwindcss"` | One line |
| JS plugins | CSS `@plugin`, `@utility`, `@variant` directives | Co-locate extensions |
| `darkMode: 'class'` | CSS `@variant dark (&:where(.dark, .dark *))` | Native CSS cascade |
| PostCSS mandatory | `@tailwindcss/postcss` OR `@tailwindcss/vite` (preferred) | Engine-agnostic |
| `bg-gradient-to-r` | `bg-linear-to-r` | "gradient" reserved for image gradients |
| `flex-shrink-*` / `flex-grow-*` | `shrink-*` / `grow-*` | Shorter, consistent |
| `ring-*` color utilities | `outline-*` for rings | Cleaner mental model |
| `dark:` variant built-in | Removed — define with `@custom-variant dark` | Cascade-respecting |
| RGB color values | OKLCH by default | Perceptually uniform |

---

## 2. Project Setup (2026 Way)

### Vite (recommended — 3–10× faster HMR)

```bash
npm install tailwindcss @tailwindcss/vite
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
})
```

```css
/* src/app.css — the entire entry file */
@import "tailwindcss";
```

That is the complete setup. No `content`, no `postcss.config`, no `tailwind.config`.

### Next.js / PostCSS fallback

```bash
npm install tailwindcss @tailwindcss/postcss postcss
```

```js
// postcss.config.mjs
export default { plugins: { '@tailwindcss/postcss': {} } }
```

```css
/* globals.css */
@import "tailwindcss";
```

---

## 3. The `@theme` Directive — Design Tokens

`@theme` defines design tokens that generate both CSS variables AND utility classes.

```css
@import "tailwindcss";

@theme {
  /* Colors → text-*, bg-*, border-*, fill-*, stroke-*, accent-* */
  --color-brand-50:  oklch(0.97 0.02 250);
  --color-brand-500: oklch(0.62 0.18 250);
  --color-brand-900: oklch(0.25 0.08 250);

  /* Typography */
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Cal Sans", var(--font-sans);
  --text-base: 1rem;
  --text-base--line-height: 1.6;

  /* Spacing scale (extends defaults) */
  --spacing-18: 4.5rem;

  /* Radii, shadows, breakpoints */
  --radius-card: 1rem;
  --shadow-elevation: 0 10px 30px -10px oklch(0.3 0.05 250 / 0.3);
  --breakpoint-3xl: 120rem;
}
```

**Generated utilities:** `--color-brand-500` ⇒ `bg-brand-500`, `text-brand-500`, `border-brand-500`, `ring-brand-500`, etc.

### `@theme inline` — Reference Existing Variables (no new ones)

```css
@theme inline {
  --color-surface: var(--color-white);
  --color-surface-dark: var(--color-zinc-900);
}
```

Use `inline` when extending an existing token system (e.g., shadcn/ui) without spawning extra variables.

### `@theme static` — Output for Non-CSS Targets

```css
@theme static {
  --color-token: #3b82f6;
}
```

Use `static` when downstream consumers (JS, build tools) need to read raw values without `var()` resolution.

---

## 4. Variants, Dark Mode, and Custom Selectors

### Built-in v4 Variants

- `hover`, `focus`, `focus-visible`, `active`, `disabled`, `visited`, `target`, `first`, `last`, `only`, `odd`, `even`, `first-of-type`, `last-of-type`, `only-of-type`
- `before`, `after`, `placeholder`, `file`, `marker`, `selection`, `first-letter`, `first-line`
- `peer` / `group` (with `peer-*` / `group-*` nesting)
- `has-[...]`, `is-[...]`, `where-[...]`, `not-[...]` (arbitrary selector wrappers)
- `aria-[...]`, `data-[...]`, `inert`, `open`
- `@container`, `@sm:`, `@md:`, `@lg:`, `@xl:`, `@2xl:`, `@max-md:`, etc.
- `starting`, `print`, `rtl`, `ltr`, `dark`, `motion-safe`, `motion-reduce`

### Dark Mode (CSS-native, replaces `darkMode: 'class'`)

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Then in markup:
```html
<html class="dark">
  <div class="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">…</div>
</html>
```

### Custom Variants

```css
@custom-variant data-loading (&[data-loading="true"]);
@custom-variant rtl (where([dir="rtl"], [dir="rtl"] *));
```

Use as: `data-loading:opacity-50`, `rtl:ml-3`.

---

## 5. Container Queries (First-Class in v4)

```html
<div class="@container">
  <div class="flex flex-col @md:flex-row @lg:gap-8">
    <img class="w-full @md:w-48" />
    <div class="@md:text-lg">…</div>
  </div>
</div>
```

**Breakpoints** (built-in container queries):
- `@xs` (20rem), `@sm` (24rem), `@md` (28rem), `@lg` (32rem), `@xl` (40rem), `@2xl` (48rem), `@3xl` (56rem), `@4xl` (64rem), `@5xl` (72rem), `@6xl` (80rem), `@7xl` (88rem)

**Range containers** (named): `@min-md:`, `@max-lg:`, `@3xl/sidebar:`.

```html
<div class="@container/sidebar">
  <div class="@min-md/sidebar:grid-cols-3">…</div>
</div>
```

---

## 6. Dynamic Utility Values (Arbitrary Values)

Arbitrary values are now **first-class** and resolved at build time with proper type-checking via `@tailwindcss/oxide` (Rust engine).

```html
<div class="mt-[clamp(1rem,4vw,3rem)]
            grid-cols-[repeat(auto-fit,minmax(280px,1fr))]
            text-[0.875rem]/[1.4]
            bg-[oklch(0.7_0.18_120)]
            shadow-[0_4px_12px_rgba(0,0,0,0.08)]
            inset-shadow-[0_2px_4px_rgba(0,0,0,0.06)]">
```

**CSS variables in arbitrary values:**
```html
<div class="bg-[var(--brand-color)] mt-[calc(theme(spacing.4)+var(--header-h))]">
```

---

## 7. Custom Utilities (`@utility`)

Replace v3's `addUtilities` plugin API.

```css
@utility tab-* {
  tab-size: --value(integer);
  -moz-tab-size: --value(integer);
}

@utility scrollbar-hidden {
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

@utility text-balance {
  text-wrap: balance;
}
```

```html
<div class="tab-4 scrollbar-hidden">…</div>
```

### Functional Utilities with Type Constraints

```css
@utility m-* {
  margin: --value([length]);   /* only length tokens */
}

@utility content-* {
  --tw-content: --value("*");
  content: var(--tw-content);
}
```

---

## 8. Custom Variants (`@custom-variant`)

```css
/* State-driven */
@custom-variant aria-current (&[aria-current="page"]);

/* Selector-based */
@custom-variant peer-checked (&:checked ~ .peer);

/* Media-query */
@custom-variant --pointer-fine (@media (pointer: fine));
```

---

## 9. Plugins (`@plugin`)

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@plugin "@tailwindcss/forms";
@plugin "./local-plugin.js";   /* JS plugin from file */
```

Legacy JS plugins still work — drop them in `@plugin` directive. For Tailwind plugins that use the v3 JS API, add `@plugin "./plugin.js";` (no quotes for local files).

---

## 10. Layers (`@layer`)

v4 uses native CSS `@layer` for cascade control. Default order (highest to lowest specificity):
1. `theme` — design tokens
2. `base` — preflight / resets
3. `components` — class-based patterns
4. `utilities` — generated utilities (highest)

```css
@layer base {
  h1 { @apply text-3xl font-bold tracking-tight; }
  body { @apply bg-surface text-foreground antialiased; }
}

@layer components {
  .btn { @apply inline-flex items-center gap-2 rounded-lg px-4 py-2; }
}

@layer utilities {
  .scroll-mt-safe { scroll-margin-top: var(--header-h); }
}
```

`@apply` still works but is **discouraged for production** in v4 — prefer plain utility classes in markup. Use `@apply` only in `@layer base` for global typography/reset rules.

---

## 11. OKLCH Color System (v4 Default)

Tailwind v4 ships OKLCH as the default color space for perceptually uniform ramps.

```css
@theme {
  --color-primary-500: oklch(0.65 0.20 260);  /* vivid blue */
  --color-success:    oklch(0.72 0.18 145);  /* green */
  --color-warning:    oklch(0.78 0.16 80);   /* amber */
  --color-danger:     oklch(0.62 0.22 25);   /* red */
}
```

**P3 / wide-gamut tips:**
- Browsers without OKLCH support silently fall back to sRGB.
- Use `oklch()` in design tokens for future-proof palettes.
- Combine with `color-mix(in oklch, var(--color-primary) 80%, white)` for variants without writing each shade.

---

## 12. Animation & Transitions

```css
@theme {
  --animate-fade-in: fade-in 0.4s ease-out;
  --animate-spin-slow: spin 3s linear infinite;

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
}
```

```html
<div class="animate-fade-in">…</div>
```

---

## 13. Migration Checklist (v3 → v4)

```bash
npx @tailwindcss/upgrade@next
```

The official codemod handles ~95% of cases. Manual follow-ups:

| v3 | v4 replacement |
|----|----------------|
| `bg-gradient-to-r` | `bg-linear-to-r` |
| `dark:bg-x` | Add `@custom-variant dark` first |
| `flex-shrink-0` | `shrink-0` |
| `flex-grow` | `grow` |
| `ring-2 ring-blue-500` | `outline-2 outline-blue-500` |
| `decoration-clone` / `decoration-slice` (box) | Same (unchanged for images only) |
| `placeholder-shown:`, `autofill:` | Still supported |
| `tailwind.config.js` `theme.extend.colors` | Move to `@theme { --color-* }` |
| `addUtilities()` JS plugin | `@utility` directive in CSS |
| `addVariant()` JS plugin | `@custom-variant` directive |
| `corePlugins` config | Remove — use `@layer` ordering or `@utility none` |
| `important: '#tw'` | Use CSS `@layer tw { @import "tailwindcss"; }` |
| `safelist` | Use `@source` directive to explicitly include files |

### `@source` for Dynamic Content

```css
@source "../node_modules/@acme/ui/dist/*.js";
@source inline("{hover:,active:,}{,focus-,focus-visible-,}{btn,card}-{primary,secondary}");
```

---

## 14. Performance & Build Optimization

1. **Use Vite plugin** (`@tailwindcss/vite`) — biggest single perf win.
2. **Avoid `@apply` chains** — they bloat output and obscure cascade.
3. **Limit arbitrary values** in hot components — they bypass static analysis caching.
4. **Enable Lightning CSS** via Vite for minification.
5. **Scope imports** to entry CSS only — don't `@import "tailwindcss"` in every component file.

---

## 15. Accessibility Patterns (v4)

```html
<button class="focus-visible:outline-2 focus-visible:outline-offset-2
               focus-visible:outline-blue-600
               aria-[current=page]:bg-blue-50">
  Active
</button>

<dialog class="open:animate-fade-in backdrop:bg-black/50">…</dialog>

<img class="not-sr-only" alt="…" />
```

- Prefer `focus-visible:` over `focus:` to avoid ring on mouse clicks.
- `forced-colors:` variant for Windows High Contrast mode (Tailwind v4.1+).
- `aria-*` and `data-*` arbitrary variants work out-of-the-box.

---

## 16. Common Pitfalls (2026)

1. **Forgetting the `@custom-variant dark`** — `dark:` silently does nothing without it.
2. **`@theme` vs `@theme inline`** confusion — use `inline` when wrapping a CSS var so the utility resolves to the original, not the wrapper.
3. **`bg-gradient-to-*` typo** — renamed to `bg-linear-to-*` in v4.
4. **Importing JS plugins** — must use `@plugin "name"` (string for npm), `@plugin "./file.js"` (no quotes for local).
5. **No `content` config** — content detection is automatic; adding `content: []` is a no-op and signals confusion.
6. **PostCSS-only setups miss Vite perf** — switch to `@tailwindcss/vite` if you can.
7. **`ring-*` utility removed** — use `outline-*` for visual rings, or `@utility ring-* { … }` if you must replicate.
8. **Mixing v3 plugins with v4** — most v3 JS plugins work via `@plugin`, but some `addVariant` patterns need rewriting as `@custom-variant`.

---

## 17. Code Generation Heuristics

When generating v4 markup:

- **Default to v4 syntax.** Never emit `bg-gradient-to-r`, `flex-shrink-0`, or `darkMode: 'class'`.
- **Use OKLCH colors** in `@theme` examples; fall back to hex only for legacy systems.
- **Prefer `container queries`** (`@sm:`, `@md:`) over viewport queries for reusable components.
- **Compose utilities directly in markup** — avoid `@apply` unless setting global typography.
- **Use semantic HTML first**, then layer utilities. Don't wrap a `<div>` where a `<button>` or `<dialog>` fits.
- **Generate the `@theme` block** when asked for a "design system" or "tokens" output.
- **Show migration diffs** (v3 → v4) when the user's codebase still uses v3 patterns.

---

## 18. Reference Resources

- Official docs: https://tailwindcss.com/docs
- v4 announcement: https://tailwindcss.com/blog/tailwindcss-v4
- Upgrade tool: `npx @tailwindcss/upgrade@next`
- Oxide engine: https://github.com/tailwindlabs/tailwindcss/tree/next/packages/oxide
- Themes.dev guide, Designer Daily v4 walkthrough, WrapPixel 2026 trends (synthesized)
