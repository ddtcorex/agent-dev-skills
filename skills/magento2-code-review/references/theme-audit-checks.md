# Theme-Scope Audit

No separate theme skill — this routes to existing skills for anything they
already cover, and defines only what doesn't exist anywhere else yet.

## 1. Detect Hyvä vs. Luma

Reuse `magento2-hyva-dev`'s "Related Skills"
section: check the theme's `theme.xml` parent (`Hyva/default`/`Hyva/reset`
vs `Magento/blank`) and `composer.json` for `hyva-themes/*` packages. The two
stacks are mutually exclusive.

## 2. Hyvä — cross-referenced checks (do not duplicate here)

- CSP compliance: `magento2-hyva-dev`'s "CSP (Content Security Policy)
  Compliance" section.
- Core Web Vitals / JS-hydration-delay: `magento2-performance-audit`'s
  `references/core-web-vitals.md` — run scoped to just this theme's page
  types, not the full 9-step project audit.

Findings from either of these two checks are tagged `M2-SEC-010` and
`M2-PERF-006` respectively — not a `M2-THEME` code, which is reserved for
the genuinely new checks in sections 3-4 below.

## 3. Hyvä — new checks (nothing else covers these today)

**Tailwind bundle-size regression / unused-class bloat** (`M2-THEME-001`):

```bash
govard sh -c "cd app/design/frontend/<Vendor>/<Theme>/web/tailwind && npm run build"
# Compare the compiled CSS size against a known-good baseline (e.g. the
# theme's last release, or main/master's build output) -- a jump of more
# than ~10-15% with no corresponding new UI is worth flagging.
ls -la app/design/frontend/<Vendor>/<Theme>/web/css/*.css
```

**Alpine hydration-root count** (`M2-THEME-002`) — a rough but concrete proxy
for hydration cost per page, feeding into `magento2-performance-audit`'s
existing (narrative-only) render-delay guidance:

```bash
grep -o 'x-data' <rendered-page-html-or-template>.phtml | wc -l
```

More than a handful of independent `x-data` roots on one page is worth
investigating for consolidation, especially if Core Web Vitals showed a
render-delay-dominated LCP for that same page type.

## 4. Luma — new checks (nothing else covers these today)

**RequireJS bundle size / unbundled-module count** (`M2-THEME-003`):

```bash
govard sh -c "bin/magento dev:js:enable_js_bundling"
govard sh -c "bin/magento setup:static-content:deploy -f"
find pub/static/frontend/*/*/*/js -name "*.js" | wc -l
du -sh pub/static/frontend/*/*/*/requirejs-*.js 2>/dev/null
```

**LESS output size** (`M2-THEME-003`):

```bash
du -sh pub/static/frontend/*/*/*/css/styles-l.css 2>/dev/null
```

Compare both against a known-good baseline the same way as the Tailwind check
above.
