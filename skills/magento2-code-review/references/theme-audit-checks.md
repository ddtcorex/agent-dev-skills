# Theme-Scope Audit

No separate theme skill — this routes to existing skills for anything they
already cover, and defines only what doesn't exist anywhere else yet.

## 1. Detect Hyvä vs. Luma — and CSP vs. non-CSP

Reuse `magento2-hyva-dev`'s "Related Skills" section: check the theme's
`theme.xml` parent (`Hyva/default`/`Hyva/reset` vs `Magento/blank`) and
`composer.json` for `hyva-themes/*` packages. The two stacks are mutually
exclusive.

If it's Hyvä, also resolve the CSP question **now**, before section 2 below
— `magento2-hyva-dev`'s "Detect the project's actual setup first" flags this
as its own axis, separate from Hyvä-vs-Luma: `Hyva/default-csp` vs. the
plain `Hyva/default`/`Hyva/reset` parent. Don't stop at reading `theme.xml`
— a project can carry leftover/cargo-culted `$hyvaCsp->registerInlineScript()`
calls even on a plain, non-CSP `Hyva/default` parent (copied from a
different project's template or an older Hyvä doc example), where they're
inert (guarded by `isset($hyvaCsp)`, which is always false) rather than a
real compliance mechanism. Confirm the pattern is actually live before
treating a missing call as a defect:

```bash
# 1. theme.xml parent
grep -n "<parent>" app/design/frontend/<Vendor>/<Theme>/theme.xml

# 2. Does a real CSP view-model class ship in this project's Hyvä packages?
grep -rl "class.*HyvaCsp\|class Csp" vendor/hyva-themes/*/  2>/dev/null

# 3. Is $hyvaCsp actually assigned to a block anywhere (layout viewModel
#    argument), not just referenced defensively in a template?
grep -rn "hyvaCsp" app/design/frontend/<Vendor>/<Theme> --include="*.xml"
```

If the parent is plain `Hyva/default`/`Hyva/reset` AND no CSP view-model
class exists in `vendor/hyva-themes/*` AND no layout wires `hyvaCsp` to a
block, this project has no working CSP-nonce mechanism at all — skip
section 2's CSP check entirely (report it as not applicable, not as a pass)
rather than flagging `registerInlineScript()` omissions as `M2-SEC-010`.
A missing call to a mechanism that doesn't exist in the project isn't a
finding; treating it as one produces a confident-sounding but wrong result,
and pointing at another template's `isset($hyvaCsp) && ...` call as the
"correct" reference is actively misleading if that call is itself dead code.

## 2. Hyvä — cross-referenced checks (do not duplicate here)

- CSP compliance: `magento2-hyva-dev`'s "CSP (Content Security Policy)
  Compliance" section — **only if section 1 confirmed the theme is
  CSP-flavored and the mechanism is actually wired up.**
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
govard sh -c "bin/magento config:set dev/js/enable_js_bundling 1"
govard sh -c "bin/magento setup:static-content:deploy -f"
find pub/static/frontend/*/*/*/js -name "*.js" | wc -l
du -sh pub/static/frontend/*/*/*/*/js/bundle/ 2>/dev/null
# Restore afterward if bundling wasn't already enabled on this project:
govard sh -c "bin/magento config:set dev/js/enable_js_bundling 0"
govard sh -c "bin/magento setup:static-content:deploy -f"
```

**LESS output size** (`M2-THEME-003`):

```bash
du -sh pub/static/frontend/*/*/*/css/styles-l.css 2>/dev/null
```

Compare both against a known-good baseline the same way as the Tailwind check
above.
