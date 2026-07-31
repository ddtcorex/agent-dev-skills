# Core Web Vitals Audit

Full detail for Workflow step 7.

## Chrome DevTools MCP (preferred, if available)

When a Chrome DevTools MCP server is connected, `performance_start_trace` (with `reload: true`, `autoStop: true`) on a navigated page gives per-navigation LCP/CLS/TTFB plus an LCP phase breakdown (TTFB/load delay/load duration/render delay) and named insights (Cache, ThirdParties, RenderBlocking, ImageDelivery, etc.) in one call — no separate install, and cleaner numbers than parsing a Lighthouse report. Run it once per page type (homepage/product/category — see `references/per-page-type-audit.md`), since LCP/CLS meaningfully differ by page type just like everything else in this skill.

## Lighthouse CI (fallback — CI pipelines, or no MCP available)

```bash
# Install Lighthouse CI
npm install -g @lhci/cli

# Run audit
lhci autorun --collect.url=https://your-store.test \
             --collect.numberOfRuns=3 \
             --assert.preset=desktop
```

## Core Web Vitals Thresholds

| Metric | Target | Warning | Critical |
|--------|--------|---------|---------|
| LCP (Largest Contentful Paint) | < 2.5s | 2.5-4s | > 4s |
| INP (Interaction to Next Paint) | < 200ms | 200-500ms | > 500ms |
| CLS (Cumulative Layout Shift) | < 0.1 | 0.1-0.25 | > 0.25 |
| FCP (First Contentful Paint) | < 1.8s | 1.8-3s | > 3s |
| TTFB (Time to First Byte) | < 800ms | 800-1800ms | > 1800ms |

## Reading an LCP breakdown when render delay dominates

The phase breakdown (TTFB / load delay / load duration / render delay) tells you *where* LCP time actually goes, not just the total. If **render delay is the overwhelming majority** of LCP — the image/resource itself loads fast, but the browser doesn't paint it until long after — the fix isn't in the network or image pipeline, it's client-side JS gating visibility. This is common on JS-driven themes (Hyvä + Alpine.js, PWA/React storefronts):

- Check whether the LCP element (or its container) starts hidden behind a reactive class/directive — Alpine's `x-cloak`, a `:class` binding that includes `opacity-0`/`hidden`/`invisible`, or an equivalent framework pattern — and only becomes visible once the framework finishes hydrating. That decouples "resource ready" from "actually painted" by however long hydration takes across the whole page, not just this element.
- Cross-check against the `DOMSize` insight: a large/deep DOM (more elements for the framework to walk and bind reactivity to) makes this worse — hydration time scales with page complexity, not just the LCP element's own markup.
- Fix: render the LCP candidate visible by default in the server-rendered HTML (plain CSS/HTML, no JS-gated class) and let the framework take over only for *subsequent* state changes (slide switching, tab changes, etc.), not the initial paint.

This is typically page-type-specific, not global — compare the LCP breakdown across all 3 page types (see `references/per-page-type-audit.md`), since the component causing it (a gallery, a carousel) often lives on only one page type, which is exactly the kind of thing a homepage-only spot check would miss.

## Manual Testing

Open Chrome DevTools > Lighthouse:
1. Select "Navigation" mode
2. Select "Mobile" and "Desktop"
3. Check all categories
4. Review opportunities
