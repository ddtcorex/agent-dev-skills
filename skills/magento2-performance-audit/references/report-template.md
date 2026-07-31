# Audit Report Template

Used by Workflow step 9 (drafting) and step 10 (the mandatory self-verification gate).

> **If the environment supports publishing a rendered page (e.g. Claude Code's `Artifact` tool), publish the report that way instead of — or alongside — raw markdown.** Severity reads as a color-coded chip/pill at a glance instead of a flat checklist, and a published link is easier to share with a team than pasted text. This is optional and environment-dependent (not available in Codex CLI/OpenCode/Copilot) — the markdown template below is the portable baseline every environment can produce, and if you do publish a rendered page, still include everything the template covers (URLs audited, all findings, severities) rather than a lighter summary.
>
> **A PDF copy can be produced from that same rendered HTML** — either the person viewing a published artifact link uses the browser's own Print → Save as PDF, or, from the CLI, headless Chrome renders it identically since the page is self-contained (inline CSS, no external fonts/CDN calls to fail mid-render):
> ```bash
> google-chrome --headless --disable-gpu --no-sandbox --no-pdf-header-footer \
>   --print-to-pdf="report.pdf" "file://$(pwd)/report.html"
> ```
> The flag that suppresses Chrome's own injected header/footer (timestamp, page title, URL, page number) is `--no-pdf-header-footer` — a similarly-named `--print-to-pdf-no-header` does not exist in current Chrome and is silently ignored, so verify the output (e.g. `pdftotext -f 1 -l 1 report.pdf -` and check for a stray date/URL line) rather than assuming the flag took effect.
> This is a rendering convenience, not a substitute for keeping the markdown/HTML source — don't generate a PDF as the only copy of a report.

```markdown
# Performance Audit Report

## URLs Audited
- Homepage: <actual URL> (usually one; list more only if the store has multiple storefront views)
- Category (small/medium/large): <3 actual URLs with their product counts> (note why each is representative — spanning the catalog's real size range, not 3 edge cases)
- Product ×3: <3 actual URLs> (note if any candidate 301-redirected and which URL actually resolved 200)

Always state the exact URLs tested, not just "homepage/category/product" — without them the report isn't reproducible or independently verifiable later. Testing 3 samples per type (not 1) is what lets a finding be reported as "confirmed across all samples of this type" rather than "seen on the one page tested."

## Infrastructure
- [ ] Application Mode: production
- [ ] PHP OPcache: >= 256MB
- [ ] Redis Session: configured
- [ ] Redis Cache: configured
- [ ] Varnish: enabled

## Cache Status
- [ ] All critical caches enabled
- [ ] FPC enabled and configured

## Cache Invalidation Efficiency
- [ ] No unexplained full/`mode=all` flushes outside deploy/indexer/explicit admin-flush windows
- [ ] Custom observers/plugins use targeted tag invalidation, not blanket `clean()`/`cache:flush`
- [ ] (Varnish only) `varnishadm ban.list` shows no overly broad patterns (e.g. `.*`) originating from custom code
- [ ] Flush frequency is proportional to actual entity save/import volume, not constant/scheduled

## Client-Side AJAX Load
- [ ] Same-origin (Magento) AJAX/XHR count on a fresh/anonymous page load noted as baseline
- [ ] No wildcard (`<action name="*">`) Customer Data invalidation rules in `sections.xml`
- [ ] No redundant `customerData.reload()` calls duplicating invalidation-rule-driven reloads
- [ ] Uncacheable (session/customer-scoped) AJAX endpoints identified — these are what crawler/bot JS execution multiplies under load, independent of FPC hit rate

## Indexer Configuration
- [ ] All indexers on "Update by Schedule"
- [ ] Cron running properly

## Database
- [ ] Query count recorded for homepage/category/product (uncached — see Per-Page-Type Audit) and compared against this project's baseline if one exists, or the tier table under Query Count: Tiers, Not a Pass/Fail Gate if this is the first audit
- [ ] No N+1 queries detected (same query shape repeated many times in one page's `var/debug/db.log`)
- [ ] Note: on a small/fast local DB, absolute query time can look fine even when count is over budget — flag on count, not just time
- [ ] Note: this count only covers the initial server-rendered HTML request — it does not include the page's own client-side AJAX/GraphQL follow-up calls (see Client-Side AJAX Load above). A low DB query count does not mean low total backend cost if the page defers real work to those follow-up requests instead of the initial render — report both together, not the DB count in isolation.
- [ ] Slow Query Analysis run (app-level `TIME:` sort and/or MySQL slow_query_log) — any query found `EXPLAIN`ed to confirm `type: ALL`/missing index before reporting it as a real finding, and slow_query_log turned back off afterward if it was enabled for this audit

## Core Web Vitals
| Metric | Value | Status |
|--------|-------|--------|
| LCP | X.Xs | PASS/FAIL |
| INP | X.Xms | PASS/FAIL |
| CLS | X.XXX | PASS/FAIL |

## Recommendations
1. ...
2. ...
3. ...
```
