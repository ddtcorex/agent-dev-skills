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
- [ ] Repeated Query Shapes table below is populated — every shape appearing more than ~5 times on any single page load is listed, not just the ones already confirmed as bugs (or explicitly stated: none found)
- [ ] Per-Page Query Detail below is populated — the *complete* normalized query breakdown for every captured page, not filtered to the >5 threshold (this is a standing report component, not optional)
- [ ] Note: on a small/fast local DB, absolute query time can look fine even when count is over budget — flag on count, not just time
- [ ] Note: this count only covers the initial server-rendered HTML request — it does not include the page's own client-side AJAX/GraphQL follow-up calls (see Client-Side AJAX Load above). A low DB query count does not mean low total backend cost if the page defers real work to those follow-up requests instead of the initial render — report both together, not the DB count in isolation.
- [ ] Slow Query Analysis run (app-level `TIME:` sort and/or MySQL slow_query_log) — any query found `EXPLAIN`ed to confirm `type: ALL`/missing index before reporting it as a real finding, and slow_query_log turned back off afterward if it was enabled for this audit

### Repeated Query Shapes

List every normalized query shape (ignore literal values, same shape = same normalized SQL) that
repeats more than ~5 times on any single captured page load — even ones that turn out to be
legitimate. A high repeat count alone isn't proof of a bug, but leaving a repeated shape out of
the report because it "probably isn't a bug" is exactly the silent judgment call this table
exists to prevent — the reader should see the evidence and be able to judge it themselves.

| Shape (normalized) | Page(s) seen on | Count (per page) | Traced to (file:line) | Assessment |
|---|---|---|---|---|
| `SELECT * FROM catalog_product_entity_varchar WHERE ...` | category_large only | 210 | `Vendor/Module/Block/Reviews.php:82` | Scales with grid size across the 3 category samples — real N+1, see Per-Page-Type Audit |
| `SELECT * FROM cms_block WHERE identifier = ?` | all 7 pages | 3 each | `Vendor/Widget/Block/Footer.php:41` | Same shape on every page type — global block, fix once for site-wide impact |

If no shape repeats more than the threshold on any captured page, state that explicitly here
(`No query shape repeated more than 5 times on any captured page`) — an empty table with no
comment reads as "not checked," not as "checked, found nothing."

Cross-reference the two diagnostic signals from `references/per-page-type-audit.md`
("Interpreting results correctly") in the Assessment column rather than just noting the raw
count: a shape repeated across *all* page types points to a global block (site-wide fix); a
shape whose count scales with the small/medium/large category (or product-list) samples points
to a per-item loop that gets worse as the catalog grows.

### Per-Page Query Detail

A **standing, mandatory part of every database-profiling report** — not something to add only
when specifically asked for. The Repeated Query Shapes table above is filtered to a >5 threshold
and exists to surface likely N+1 candidates; this section is the unfiltered complement: for each
of the 7 captured pages, the complete list of every distinct normalized query shape that ran on
that page load, with its count. It's what turns a one-off audit into reference documentation —
a later audit (or a teammate) can diff against it to see exactly what changed, rather than relying
on memory of "roughly what a category page used to query."

For each page:

| Count | SQL (normalized) |
|---|---|
| 22 | `SELECT eav_attribute.* WHERE attribute_code=? AND entity_type_id=?` |
| 20 | `SELECT catalog_eav_attribute.* WHERE attribute_id=?` |
| 1 | `SELECT ... FROM cms_block WHERE block_id=?` |

If publishing as a rendered Artifact, put each page's table inside a collapsed `<details>` block
(page name + total count + distinct-shape count in the `<summary>`) so the report stays scannable
rather than dominated by 7 long tables. In plain markdown, a `<details>`/`<summary>` block works
the same way in GitHub-flavored Markdown; fall back to one table per page under its own
subheading if the renderer doesn't support it.

## Block/Template Rendering (HTML Profiler)
- [ ] Slowest Blocks/Templates table below is populated for every captured page — every timer using more than ~5% of that page's total time, or firing double-digit-or-higher `Cnt`, is listed (or explicitly stated: none found)

### Slowest Blocks/Templates

List every profiler timer that meets the threshold above — see `references/html-profiler-audit.md`
for what each column means and how to trace a timer to custom code.

| Timer Id | Page(s) | Time | Cnt | Custom code? | Assessment |
|---|---|---|---|---|---|
| `...->Vendor\Module\Block\Reviews::_toHtml` | product_2, product_3 | 1.2s | 1 | Yes (`app/code`) | Single expensive call, `Cnt: 1` — heavy constructor or synchronous API call, see Code-Level Performance Patterns |
| `...->Magento\Catalog\Block\Product\ListProduct::_toHtml` | category_large | 0.4s | 24 | No (core, but `Cnt` is high) | Per-item render loop — check for a plugin adding per-product work |

If no timer meets the threshold on any captured page, state that explicitly here (`No block/
template timer exceeded the threshold on any captured page`) — same rule as the Repeated Query
Shapes table above: an empty table with no comment reads as "not checked."

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
