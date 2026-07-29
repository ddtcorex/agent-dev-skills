---
name: magento2-performance-audit
description: |
  Performs comprehensive performance and health audit for Magento 2 projects. Use when:
  - "Audit performance", "check Core Web Vitals", "run Lighthouse"
  - "Check server configuration", "verify Redis/Varnish setup"
  - "Analyze database queries", "find N+1 query issues"
  - "Review indexer configuration", "check cron health"
  - "Debug cache flush", "why does full_page cache keep flushing", "trace FPC invalidation"
  - "Too many ajax requests", "customer data section reload storm", "crawler overloading server"

  This skill runs automated checks against Adobe Commerce Best Practices. DEPENDENT on magento2-dev-core
  for code-level performance patterns.
compatibility: claude, codex, opencode, copilot
depends: [magento2-dev-core]
metadata:
  audience: developers
  workflow: magento
---

# Magento 2 Performance Audit

This skill performs a comprehensive audit of Magento 2 performance, infrastructure, and code-level patterns.

## Related Skills

**REQUIRED BACKGROUND:** Load `magento2-dev-core` first — code-level fixes for N+1 queries and heavy constructors follow the patterns it defines.

Part of the QA trio with `magento2-linter` and `magento2-security-scan`. Async/queue findings often point back to `magento2-backend-dev`.

## Audit Categories

### 1. Infrastructure Configuration

| Check | Expected | Command |
|-------|----------|---------|
| Application Mode | `production` | `bin/magento deploy:mode:show` |
| PHP OPcache | >= 256MB | Check php.ini |
| Redis (Session) | Enabled | Check `app/etc/env.php` |
| Redis (Cache) | Enabled | Check `app/etc/env.php` |
| Varnish | Running + terminating HTTPS/HTTP in front of the app | Check for a running Varnish container/process and its VCL config; the exact config file is project-specific (e.g. `nginx.conf`, a Docker/orchestrator config file, or a cloud provider's Varnish config) — there is no universal filename to grep for. |

> On a **local dev environment** it's normal and expected to have no Redis/Varnish at all (file-based session/cache, FPC often disabled) — don't flag this as a bug unless the target is staging/production. Confirm which environment you're actually auditing before treating any of the above as a problem.

### 2. Cache Configuration

```bash
# Verify all caches enabled
govard sh -c "bin/magento cache:status"

# Expected output
# Category          Status    Enabled
# config            1         1
# layout            1         1
# block_html        1         1
# full_page         1         1
```

> If `full_page` cache is flushing far more often than page saves/deploys would explain, see **Cache Invalidation Efficiency Audit** below — Magento's own entity-save invalidation is narrowly scoped by design; unexplained broad/frequent flushes are almost always custom observer or plugin code.

### 3. Indexer Configuration

```bash
# Check indexer mode (Update by Schedule is CRITICAL for performance on larger catalogs)
govard sh -c "bin/magento indexer:status"

# Switch a specific indexer to schedule mode (don't blanket-apply to all — see table below)
govard sh -c "bin/magento indexer:set-mode schedule <indexer_code>"

# Reindex all
govard sh -c "bin/magento indexer:reindex"
```

| Indexer | Recommended Mode |
|---------|------------------|
| catalog_product_price | Update on Save for small catalogs / frequent price changes; Update by Schedule for large catalogs (thousands+ SKUs) where synchronous reindex-on-save would slow down admin saves and imports. Don't apply one rule blindly — check catalog size and how prices are updated (manual saves vs. bulk import) first. |
| catalog_url_category | Update by Schedule |
| catalog_category_product | Update by Schedule |
| inventory | Update by Schedule |
| targetrule | Update by Schedule |

**Also check that cron is actually running and draining the changelog** — schedule-mode indexers are only as fresh as the last successful cron run. Check `crontab -l` for a magento entry, and query `cron_schedule` for recent `success` rows (`SELECT MAX(executed_at) FROM cron_schedule WHERE status='success'`) — an idle cron combined with schedule-mode indexers silently produces stale prices/URLs/inventory with no error anywhere.

> **On local dev, no crontab at all is frequently deliberate, not an oversight** — same "confirm the environment before treating it as a problem" rule as Infrastructure Configuration above. A developer box often stays idle by design so nothing runs unattended in the background; report a missing local crontab as **informational** ("cron isn't installed here — confirm this is intentional, and separately confirm staging/production actually has it"), not as a severity finding in its own right. Escalate to a real finding only once you've confirmed the target is staging/production, or that the *project's* cron is missing there too.

### 4. Async Operations (message queue consumers)

Bulk APIs, async email sending, and async operations in Magento all run through message queue consumers — they don't do anything unless the consumers are actually running as processes (via cron or a supervisor), not just configured.

```bash
# List available consumers (does NOT start/enable them — just enumerates what's defined)
govard sh -c "bin/magento queue:consumers:list"

# Check whether consumers are actually running as processes
govard sh -c "ps aux | grep 'queue:consumers:start'"

# Start a specific consumer manually (for testing — production should run these via cron/supervisor)
govard sh -c "bin/magento queue:consumers:start <consumer_name> --max-messages=100"
```

If no `queue:consumers:start` processes are running and there's no cron/supervisor job launching them, bulk operations and async email will queue up in `queue_message` tables and never actually process — check for this rather than assuming a config flag turns "async" on.

**Read the consumer list before filing this as a routine perf finding.** Most idle consumers are a performance/staleness issue (bulk operations, grid indexing, async email). But payment-related consumers (order invoicing/refunding/capture, e.g. a payment module's own `*.order.invoicing`/`*.order.refunding` queues) or inventory-reservation consumers being idle are a **business-critical** issue, not a performance one — invoices, refunds, or stock reservations silently never processing has direct financial/customer impact. Scan the consumer names for payment/inventory keywords and flag those separately at higher severity than a generic "consumers aren't running" note.

> **On local dev, idle consumers (and no cron running them) are often the safe/correct state, not a bug — including for payment consumers.** A local box frequently runs against a synced/sanitized copy of real customer and order data; if a payment-invoicing or email consumer *did* process its queue, it could fire real emails to real customer addresses or hit a live payment gateway API with sandboxed-looking-but-real order data. Don't report "payment consumers aren't running" as a business-critical finding on a local environment without first confirming that's actually a problem there — it's frequently the deliberate, correct default. Report it as **informational** locally ("consumers idle — confirm this is intentional for local safety, and separately verify staging/production has them running"), and reserve the business-critical severity for when you've confirmed the target is staging/production, where idle payment/inventory consumers really do mean unprocessed invoices/refunds/reservations.

### 5. Asset Optimization

```bash
# JS Bundling (recommended for production)
govard sh -c "bin/magento config:set dev/js/enable_js_bundling 1"
govard sh -c "bin/magento config:set dev/js/minify_files 1"

# CSS Minification
govard sh -c "bin/magento config:set dev/css/minify_files 1"
```

## Core Web Vitals Audit

### Chrome DevTools MCP (preferred, if available)

When a Chrome DevTools MCP server is connected, `performance_start_trace` (with `reload: true`, `autoStop: true`) on a navigated page gives per-navigation LCP/CLS/TTFB plus an LCP phase breakdown (TTFB/load delay/load duration/render delay) and named insights (Cache, ThirdParties, RenderBlocking, ImageDelivery, etc.) in one call — no separate install, and cleaner numbers than parsing a Lighthouse report. Run it once per page type (homepage/product/category — see Per-Page-Type Audit below), since LCP/CLS meaningfully differ by page type just like everything else in this skill.

### Lighthouse CI (fallback — CI pipelines, or no MCP available)

```bash
# Install Lighthouse CI
npm install -g @lhci/cli

# Run audit
lhci autorun --collect.url=https://your-store.test \
             --collect.numberOfRuns=3 \
             --assert.preset=desktop
```

### Core Web Vitals Thresholds

| Metric | Target | Warning | Critical |
|--------|--------|---------|---------|
| LCP (Largest Contentful Paint) | < 2.5s | 2.5-4s | > 4s |
| INP (Interaction to Next Paint) | < 200ms | 200-500ms | > 500ms |
| CLS (Cumulative Layout Shift) | < 0.1 | 0.1-0.25 | > 0.25 |
| FCP (First Contentful Paint) | < 1.8s | 1.8-3s | > 3s |
| TTFB (Time to First Byte) | < 800ms | 800-1800ms | > 1800ms |

### Reading an LCP breakdown when render delay dominates

The phase breakdown (TTFB / load delay / load duration / render delay) tells you *where* LCP time actually goes, not just the total. If **render delay is the overwhelming majority** of LCP — the image/resource itself loads fast, but the browser doesn't paint it until long after — the fix isn't in the network or image pipeline, it's client-side JS gating visibility. This is common on JS-driven themes (Hyvä + Alpine.js, PWA/React storefronts):

- Check whether the LCP element (or its container) starts hidden behind a reactive class/directive — Alpine's `x-cloak`, a `:class` binding that includes `opacity-0`/`hidden`/`invisible`, or an equivalent framework pattern — and only becomes visible once the framework finishes hydrating. That decouples "resource ready" from "actually painted" by however long hydration takes across the whole page, not just this element.
- Cross-check against the `DOMSize` insight: a large/deep DOM (more elements for the framework to walk and bind reactivity to) makes this worse — hydration time scales with page complexity, not just the LCP element's own markup.
- Fix: render the LCP candidate visible by default in the server-rendered HTML (plain CSS/HTML, no JS-gated class) and let the framework take over only for *subsequent* state changes (slide switching, tab changes, etc.), not the initial paint.

This is typically page-type-specific, not global — compare the LCP breakdown across all 3 page types (see Per-Page-Type Audit below), since the component causing it (a gallery, a carousel) often lives on only one page type, which is exactly the kind of thing a homepage-only spot check would miss.

### Manual Testing

Open Chrome DevTools > Lighthouse:
1. Select "Navigation" mode
2. Select "Mobile" and "Desktop"
3. Check all categories
4. Review opportunities

## Database Query Profiling

> **Always verify what you actually captured, not just that curl returned something.** A `curl` with a bare `Accept: text/html` and no `User-Agent` (curl's own default) does not behave like a real browser request on every project — on one real audit, that exact combination silently routed into a REST/webapi content-negotiation edge case and returned a fatal 500 error page instead of the real page, on every single page type, while a real browser hitting the identical URL got a normal 200. The captured body still "looked like" a page (it had HTML, a stack of queries, a profiler table) — nothing about the capture itself signaled failure. The query counts from that 500 page were reported as real findings and were wrong by 20–70×. Two non-negotiable habits prevent this:
> 1. **Check the HTTP status code on every captured request** (`-w "%{http_code}"`) and treat anything other than 200 as a failed capture, not data — never analyze a body you haven't confirmed the status of.
> 2. **Use a realistic browser `Accept` header and `User-Agent`**, not framework-minimum ones, so the request exercises the same code path a real visitor hits:
>    ```bash
>    UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
>    ACCEPT="text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
>    ```
>    Every `curl` command below assumes these two variables are set first.
> 3. **Confirm the URL you're about to test is actually the target, not a same-named remote.** In a multi-environment shop (local Docker + staging + production sharing similar hostnames), a project's own `core_config_data`/`env.php` `base_url` can be stale — copied over from a staging/production sync — and point at a completely different server than the container you're running `govard sh`/`govard db` commands against. A `curl` to that stale URL still returns 200 with valid-looking Magento HTML and headers (including a real `X-Magento-Cache-Debug`), so nothing *looks* wrong — every query-log/profiler capture that follows is then silently empty (wrong box entirely) or measuring someone else's environment. Get the real local hostname from the environment tooling itself (e.g. `govard open admin` prints it) rather than trusting `base_url` blindly, and sanity-check with `curl -skI <url> | grep -i x-backend-server` — confirming it maps to the same box you're running commands against before capturing anything.

### Query Count: Tiers, Not a Pass/Fail Gate

A flat "under 80 on homepage, under 150 on category/product" number looks precise but isn't realistic for a real commerce Magento build. Vanilla Magento might hit those numbers, but a project with a typical real-world extension stack — payment gateways, GDPR/compliance, personalization, sorting/merchandising, feeds, the kind of thing every serious Magento business runs — routinely adds its own per-extension query overhead on top, and there's no single number that separates "healthy stack of extensions" from "one of them has a bug." Read the total as a tiered signal instead:

| Range | Read |
|-------|------|
| 50–150 | Vanilla/near-vanilla Magento |
| 150–500 | Typical for a handful of extensions — review the top repeated shapes, don't assume it's fine just because it's under some number |
| 500–1,500 | Heavy extension stack — investigate the top 5 repeated shapes specifically; may be legitimate cumulative cost or may hide a bug |
| 1,500+ | Almost certainly one or more real N+1 bugs on top of extension overhead, not extension overhead alone |

**Establish a project-specific baseline instead of judging against a universal number.** The first time you audit a project, capture the query count as-is (after fixing anything the audit finds) and record it as that project's baseline. On every subsequent audit, compare against *that* baseline, not the table above — a regression from 400 to 900 matters regardless of which tier both numbers fall in, and a number that's always been 900 is a different conversation from a fresh spike to 900. The tiered table is a starting point for a project with no recorded baseline yet; the baseline is what actually matters once one exists.

The repeated-shape and cross-page-type signals elsewhere in this skill remain the primary diagnostic either way — they tell you *what* to fix regardless of which tier the total falls into.

### DB Query Log Setup

```bash
# Enable full query logging with call stacks (see caveat below on log size)
govard sh -c "bin/magento dev:query-log:enable --include-all-queries=true --include-call-stack=true --query-time-threshold=0"

# Visit the page(s) to capture queries — output goes to var/debug/db.log (plain text, NOT *.sql)
# Format per entry: a "## <connectionId> ## QUERY" header (the connection id varies, so don't
# anchor a grep on a bare "## QUERY" — it will never match), then "SQL: ...", "AFF: <rows>",
# "TIME: <seconds>", then (if --include-call-stack=true) a full PHP call stack — use the stack
# to trace a repeated/slow query back to the exact file:line that issued it.

# Count queries for one page load: clear the log, hit the page once, count entries
govard sh -c "> var/debug/db.log"
code=$(curl -sk -H "Accept: $ACCEPT" -A "$UA" -o /dev/null -w "%{http_code}" https://store.test/)
[ "$code" = "200" ] || { echo "ABORT: got HTTP $code, not 200 — this capture is not valid data"; }
govard sh -c "grep -c '## QUERY' var/debug/db.log"

# ALWAYS disable when done — this is expensive and grows fast (a single page load with
# --include-call-stack=true can produce several MB of log; on a bigger page ~10+ MB is normal)
govard sh -c "bin/magento dev:query-log:disable"
```

> **Two-pass strategy keeps log volume sane.** `--include-call-stack=true` walks and serializes a full PHP stack trace for *every* query — several MB per page, and that compounds fast once you're capturing 3 page types (see Per-Page-Type Audit below). Run pass 1 with `--include-call-stack=false` (or just omit repeated shapes/counts are all you need to spot an N+1 candidate) across every page you're auditing; only re-enable `--include-call-stack=true` for a second, targeted re-capture of the specific page(s) whose repeated shape you're now tracing to a file:line. Stack-walking every page from the start is the slower, heavier default — reserve it for the one or two pages that actually need it.

### Common Query Issues

| Issue | Pattern | Impact |
|-------|---------|--------|
| N+1 Query | `foreach` with `->load()` inside, or the same normalized query shape (ignore literal values) appearing dozens of times in `var/debug/db.log` for one page load | High |
| Full Collection Load | `count($collection)` | Medium |
| Missing Index | `WHERE unindexed_column` | High |
| Expensive Join | Multiple JOINs on large tables | Medium |

> **Check the call stack's namespace before deciding how to fix.** A repeated query traced back to `vendor/<vendor-name>/...` (a paid extension, not `vendor/magento/`) isn't yours to patch directly — check for a newer version of that extension first, and if none fixes it, wrap the offending call with a request-level memoization layer (a plugin/decorator that caches the result for the current request) rather than editing vendor code, which a composer update will silently overwrite.

### Slow Query Analysis

The query-count/N+1 audit above catches queries that run *too often*; it says nothing about queries that are individually slow (a missing index, an expensive JOIN, a huge unbounded scan) — those need their own check, and they matter even when the total query count looks healthy. Two complementary levels, cheapest first:

**1. App-level: reuse the query log you already have, sorted by time instead of count.** `dev:query-log:enable` already records a `TIME:` line per query — you don't need MySQL's own slow log just to catch a slow query that happened *during a page load you were already capturing* for the N+1 audit:

```bash
# Either grep an existing db.log capture for anything at/above a threshold...
govard sh -c "grep -B1 -A2 'TIME: [1-9]' var/debug/db.log"   # >= 1.000s; adjust the pattern for your threshold

# ...or capture ONLY slow queries directly, with call stacks, across real traffic:
govard tool magento dev:query-log:enable --include-all-queries=false --query-time-threshold=1 --include-call-stack=true
# ... reproduce traffic / browse pages ...
govard tool magento dev:query-log:disable
```

This only sees queries triggered through Magento's own app requests. It won't catch slow queries from cron jobs, CLI imports, or anything else hitting the same database — for that, go to the DB itself.

**2. DB-level: MySQL/MariaDB's own slow query log** catches everything regardless of source:

```bash
# Check current state first — don't assume it's off or on
govard db query "SHOW VARIABLES LIKE 'slow_query_log%'"
govard db query "SHOW VARIABLES LIKE 'long_query_time'"

# Enable for the duration of this audit (session-safe; SET GLOBAL persists until restart or explicit disable)
govard db query "SET GLOBAL slow_query_log = 'ON'; SET GLOBAL long_query_time = 1;"

# Find where it's writing, then let the box run its normal/representative traffic for a while
govard db query "SHOW VARIABLES LIKE 'slow_query_log_file'"

# Analyze with mysqldumpslow (ships with every MySQL/MariaDB install — no extra tooling needed):
govard sh -c "mysqldumpslow -s t -t 10 <slow_query_log_file>"   # top 10 by total time
# pt-query-digest (Percona Toolkit), if installed, gives richer per-query-shape stats:
# govard sh -c "pt-query-digest <slow_query_log_file>"

# ALWAYS disable when done — same "diagnostic state, not a running state" rule as everywhere
# else in this skill; a slow log left on writes disk forever and nobody remembers why
govard db query "SET GLOBAL slow_query_log = 'OFF';"
```

**3. For each slow query found, `EXPLAIN` it before guessing at a fix:**

```bash
govard db query "EXPLAIN <the exact slow SQL, with real values substituted for placeholders>"
```

Read the `type` and `key` columns first — `type: ALL` (full table scan) or an empty `key` (no index used) on a query filtering/joining on a non-trivial row count is the smoking gun. Common Magento-specific causes: a `WHERE` on a custom/EAV attribute column with no matching index, a report/export query missing a composite index that matches its actual filter+sort combination, or a JOIN condition that doesn't line up with either side's index. Cross-reference against the `Missing Index`/`Expensive Join` rows in Common Query Issues above — this `EXPLAIN` step is how you confirm those heuristic grep hits are real, rather than reporting a `WHERE` clause as a finding on pattern-match alone.

> **Local dev DBs are small and fast** — the absolute query *time* on a local box will often look fine (tens of milliseconds total) even when the query *count* is far over budget, and a query that would be a real `type: ALL` full-scan problem on production's actual row counts can run in a few ms locally with a table of 50 rows. Raw count is what matters for the N+1 check above; for this slow-query check, don't trust a fast local `EXPLAIN` on a near-empty table as proof the query is fine at production scale — check `type`/`key` on the query plan itself, not just how fast it happened to run against this box's data.

### HTML Profiler (per-request timing breakdown)

```bash
# Enable the code profiler with HTML output
govard sh -c "bin/magento dev:profiler:enable html"

# IMPORTANT: the profiler only activates if the request's Accept header contains "text/html" —
# a bare `curl -s` without this header will produce NO profiler output at all (this is checked
# in app/bootstrap.php). Always include it, along with a realistic UA/Accept (see warning above)
# and a status check:
curl -sk -H "Accept: $ACCEPT" -A "$UA" -o page.html -w "%{http_code}\n" https://store.test/

# The profiler table is appended near the end of the HTML response body (a
# `<table border="1">...</table>` with columns: Timer Id, Time, Avg, Cnt, Emalloc, RealMem).
# Timer Id values use "->" as a nesting separator and are also embedded in each cell's
# `title="..."` attribute — if parsing programmatically, match on `<td title="[^"]*">(.*?)</td>`,
# not a naive `<td[^>]*>`, since the nesting arrows inside the attribute value will break a
# naive parser that treats any ">" as the tag's end.

# Disable when done
govard sh -c "bin/magento dev:profiler:disable"
```

## Per-Page-Type Audit (homepage, product, category)

A single-page spot check isn't representative — different page types have very different bottleneck shapes (a CMS-heavy homepage vs. a layout-heavy product page vs. a grid-heavy category page). Audit at least one of each of these three page types, using both the HTML profiler and the query log together, with `full_page`, `block_html`, and `layout` caches **disabled** so you're measuring true cache-miss cost (the worst case every real cache-miss/deploy/flush pays) rather than a warm-cache request that tells you almost nothing.

**Sample 3 URLs per page type, not 1 — except homepage, which is usually singular** (unless the store has multiple storefront views, in which case sample those too). One category and one product tells you *a* number; it can't tell you whether that number is representative of the type or an artifact of the one page you happened to pick, and it can't catch a bug whose cost only becomes visible at scale (see the size-scaling diagnostic under "Interpreting results correctly" below — it needs at least 3 differently-sized samples of the same type to work at all). Three samples per type is enough to show a pattern without turning the audit into a full crawl.

### 0. Pick genuinely representative pages first

Before measuring anything, verify the specific URLs you're about to test aren't degenerate cases — this is the single easiest way to get a misleading audit:

```bash
# Category: pull a spread of product counts, not just one — you want a small, a medium,
# and a large category (not the single largest root category, which is its own edge case)
govard db query "SELECT category_id, COUNT(*) cnt FROM catalog_category_product GROUP BY category_id ORDER BY cnt LIMIT 200"
# then pick 3 across that range, e.g. one ~10, one ~50-100, one ~200+

# Product: confirm each candidate is assigned to a website (unassigned products 404 / aren't routable)
govard db query "SELECT * FROM catalog_product_website WHERE product_id=<id>"

# Product: also watch for url_rewrite entries that 301/302 redirect elsewhere (including,
# in some data sets, out to a live production domain) — follow redirects manually first,
# don't blindly -L through them into a request against someone's production site
curl -sk -o /dev/null -w "%{http_code} -> %{redirect_url}\n" https://store.test/<product-url>.html
```

Pick 3 categories spanning small/medium/large product counts (not the single largest root category, not an edge case), and 3 products that each resolve 200 directly — varying product type (simple/configurable) if the catalog has both.

### 1. Set up the uncached measurement environment

```bash
govard sh -c "bin/magento dev:profiler:enable html"
govard sh -c "bin/magento dev:query-log:enable --include-all-queries=true --include-call-stack=true --query-time-threshold=0"
govard sh -c "bin/magento cache:disable full_page block_html layout"
govard sh -c "bin/magento cache:flush"

# One throwaway request first (discard its output/log) — this lets config/eav/compiled_config
# caches rebuild after the flush so that one-time rebuild cost doesn't contaminate the
# per-page numbers you're about to capture. Confirm it's actually 200 before proceeding —
# a broken warmup means every capture after it is measuring a failure, not a page.
curl -sk -H "Accept: $ACCEPT" -A "$UA" -o /dev/null -w "warmup: %{http_code}\n" https://store.test/
govard sh -c "> var/debug/db.log"
```

### 2. Capture each page type separately

For each of the (typically 7: 1 home + 3 category + 3 product) URLs, clear the query log, fetch with a realistic `Accept`/User-Agent (see warning under Database Query Profiling above), save the HTML (for the profiler table) and a copy of the query log, then clear the log again before the next page — **checking the HTTP status every time**, since a non-200 response still produces a plausible-looking HTML file and query log that will silently corrupt every number downstream if you don't check:

```bash
declare -A urls=(
  [home]="/"
  [category_small]="/<small-category-url>.html"
  [category_medium]="/<medium-category-url>.html"
  [category_large]="/<large-category-url>.html"
  [product_1]="/<product-url-1>.html"
  [product_2]="/<product-url-2>.html"
  [product_3]="/<product-url-3>.html"
)
for name in "${!urls[@]}"; do
  url="${urls[$name]}"
  code=$(curl -sk -H "Accept: $ACCEPT" -A "$UA" -o "${name}.html" -w "%{http_code}" "https://store.test$url")
  echo "$name ($url): HTTP $code"
  [ "$code" = "200" ] || echo "  ^ NOT 200 — discard this capture, do not analyze ${name}.html/${name}.db.log"
  cp var/debug/db.log "${name}.db.log"
  govard sh -c "> var/debug/db.log"
done
```

Analyze each page's `*.html` for its profiler table (slowest TEMPLATE/BLOCK rows, and total in-app time via the root `magento` timer) and each `*.db.log` for total query count, repeated/duplicate query shapes (candidate N+1s), and — using the call stack in each entry — the exact file:line responsible for the worst offenders.

### 3. Always restore state afterward

```bash
govard sh -c "bin/magento cache:enable full_page block_html layout"
govard sh -c "bin/magento cache:flush"
govard sh -c "bin/magento dev:profiler:disable"
govard sh -c "bin/magento dev:query-log:disable"
rm -f var/debug/db.log
```

Don't leave a target environment with caches disabled and full query logging on — this is a diagnostic state, not a normal running state, and matters especially if the target is shared with other developers or is staging rather than a disposable local box.

### Interpreting results correctly

- **A `curl` wall-clock time captured while the profiler and call-stack query logging are both active is not representative of real page load time** — the instrumentation itself (especially `--include-call-stack=true`, which walks and serializes a full PHP stack on every single query) adds real overhead, sometimes an order of magnitude. Use this setup to get query counts, repeated shapes, and file:line traces — not to report "the homepage takes N seconds." For actual load-time numbers, use the Core Web Vitals Audit above (Chrome trace / Lighthouse) on the same pages with instrumentation off.
- **Query count vs. query time are different signals.** A small/fast local DB can show trivial total query *time* (tens of ms) even when the query *count* is 3–5x over budget — don't dismiss a high count just because local timing looks fine; the count is what will hurt on production's real network round-trips and larger tables.
- **Not every slow section benefits from the caches you just disabled.** `layout` cache only skips re-parsing/merging layout XML — it does NOT skip instantiating the PHP block objects for every declared block (that happens fresh on every request regardless of cache, since live objects can't be cached across requests). If a page's time is dominated by layout *generation* rather than block *rendering*, re-enabling `layout`/`block_html` cache won't fix it — the real lever is reducing how many blocks/modules contribute to that page's layout.
- **A query shape repeated with near-identical counts across all 3 page types** (not just one) is a strong signal it comes from a globally-rendered block (header/footer/cart-drawer widget), not something page-specific — prioritize fixing that over a page-specific N+1, since it's paid on every single page view site-wide.
- **A query shape whose count scales with the grid size, across your 3 category (or product-list) samples, is a separate signal from the one above — and needs at least 3 differently-sized samples to see at all.** Compare total query count and specific shape counts across the small/medium/large category samples: a shape whose count tracks the product count roughly 1:1 (e.g. ~10 on the 10-product category, ~200 on the 200-product one) is a per-item loop that isn't using the collection's already-batched data — a real N+1 that gets *worse as the catalog grows*, not a fixed per-page cost. This is exactly the kind of bug a single-category spot check cannot reveal: on a 9-product category it might add an invisible ~10 queries; on a 200-product one it's ~1,000+. Trace it with a call-stack-enabled re-capture of the largest sample (see the two-pass note above) — common culprits are a rich-snippets/structured-data block, a review-summary widget, or a price/label renderer that calls a per-product model method (e.g. `ReviewSummary::load($id)`, a pricing `Price::getValue()` behind a custom `around` plugin) instead of pre-loading via the collection (`addSummaryData()`, `addFinalPrice()`, etc.).
- **This query count is only the initial server-rendered request** — a page that looks cheap here can still defer real work to its own client-side AJAX/GraphQL calls (see Client-Side AJAX Request Load Audit below), which this count never sees. Don't report a low DB query count as "this page is lightweight" without also checking what it fetches after the HTML loads.

## Cache Invalidation Efficiency Audit

Magento's default invalidation on entity save (product, category, CMS block/page, etc.) is already narrowly scoped — `getIdentities()` on the saved entity returns a small set of cache tags, and only pages/blocks carrying those tags get cleared. The problem this section targets is **custom code** (an observer, a plugin, a cron job, a "just flush everything to be safe" habit) that widens or duplicates that invalidation — clearing the entire `full_page` cache (or all cache types) on saves that only ever needed to touch a handful of tags. This is invisible in `cache:status` (caches are still "Enabled") and easy to miss without tracing what actually gets cleared and why.

### A. Built-in FPC (Redis or file cache backend, no Varnish)

Every Magento cache frontend (config, layout, block_html, full_page, etc.) is wrapped by `Magento\Framework\Cache\Frontend\Decorator\Logger` out of the box (see `vendor/magento/magento2-base/app/etc/di.xml`) — this is backend-agnostic (identical on Redis or file) and needs **no env.php change at all**. Every `clean()`/`remove()` call already logs a `cache_invalidate:` line at DEBUG level via `Magento\Framework\Cache\InvalidateLogger`, e.g.:

```
[...] main.DEBUG: cache_invalidate:  {"method":"GET","url":"http:/...","invalidateInfo":{"tags":["cat_p_123","FPC"],"mode":"matchingTag"}} []
[...] main.DEBUG: cache_invalidate:  {"method":"GET","url":"http:/...","invalidateInfo":{"tags":["FPC"],"mode":"matchingTag"}} []
```

**1. Confirm debug logging reaches `var/log/debug.log`.** Whether these DEBUG records are actually written depends on deployment config, not admin store config — `bin/magento config:set dev/debug/debug_logging 1` targets the wrong config store and will error (`Le chemin ... n'existe pas` / "path does not exist"). The real toggle is a deployment config value (`app/etc/env.php`), defaulting to **on** whenever the app is not in `production` mode:

```bash
govard sh -c "bin/magento deploy:mode:show"   # developer/default -> logging is on by default, nothing to change
# Only needed on production (verbose — logs ALL debug-level messages app-wide, not just cache;
# always pair with the matching --enable-debug-logging=0 once diagnosis is done):
govard sh -c "bin/magento setup:config:set --enable-debug-logging=1"
```

> **No admin credentials available this session?** Reproducing a real entity save needs an authenticated admin action — don't work around that by writing directly to the DB or running a one-off bootstrap script against live data just to force a log line. If credentials aren't available, mark this section **unverified** in the report rather than skipping it silently, and say what *was* checked instead — e.g. a CLI/cron-triggered path like `indexer:reindex`, which exercises the same `clean()`/`cache_invalidate:` logging but isn't a stand-in for observer/plugin behavior on an actual admin save.

**2. Reproduce ONE isolated action, then grep for the invalidation trail:**

```bash
govard sh -c "> var/log/debug.log"
# ... perform the action (save one product, run one cron job, etc.) ...
govard sh -c "grep 'cache_invalidate:' var/log/debug.log"
```

Read the `tags`/`mode` in each `invalidateInfo` payload. A correctly-scoped save produces tags that pair the entity's own tag with the type tag (e.g. `["cat_p_123","FPC"]`) — Magento adds `"FPC"` as `full_page`'s type-scope tag automatically, it does not by itself mean "everything got cleared". The actual smoking gun is an entry whose tags are **only** the bare type tag (`["FPC"]` alone, with no accompanying entity tag) — that clears every single cached page for one action. Also watch for the *same* tag set logged more than once within a few seconds of one save — that can be a redundant custom observer, though first rule out an async reindex (schedule-mode indexer draining the changelog) re-triggering the same invalidation shortly after, which is expected behavior, not a bug.

**3. Cron/CLI-triggered invalidations, or entries whose `url`/`method` don't identify the caller** (a CLI-run action logs a generic `"method":"GET","url":"http:/"` with no useful context): add a temporary diagnostic plugin that logs a stack trace whenever `clean()` is called broadly — this is the only way to get a file:line for something triggered outside an HTTP request.

```php
<?php
// app/code/Vendor/DevTools/Plugin/TraceCacheClean.php — TEMPORARY, remove after diagnosis
declare(strict_types=1);

namespace Vendor\DevTools\Plugin;

use Magento\Framework\App\Cache;
use Psr\Log\LoggerInterface;

class TraceCacheClean
{
    public function __construct(private readonly LoggerInterface $logger)
    {
    }

    public function beforeClean(Cache $subject, $mode = \Zend_Cache::CLEANING_MODE_ALL, array $tags = []): array
    {
        // Log unconditionally — only run this during ONE isolated reproduction step, so volume stays manageable
        $this->logger->debug(
            sprintf("CACHE CLEAN mode=%s tags=%s\n%s", $mode, implode(',', $tags), (new \Exception())->getTraceAsString())
        );
        return [$mode, $tags];
    }
}
```

```xml
<!-- app/code/Vendor/DevTools/etc/di.xml — TEMPORARY -->
<type name="Magento\Framework\App\Cache">
    <plugin name="devtools_trace_cache_clean" type="Vendor\DevTools\Plugin\TraceCacheClean"/>
</type>
```

The logged trace's file:line points directly at the observer/plugin/cron job issuing the clean. **Remove this plugin (and, if it was changed on production, revert `--enable-debug-logging`) as soon as diagnosis is done** — same rule as the query-log/profiler tools elsewhere in this skill: this is a diagnostic state, not something to leave running.

### B. Varnish-fronted FPC

Varnish invalidation happens via HTTP BAN requests carrying an `X-Magento-Tags-Pattern` header — Magento's `debug.log` doesn't see this directly, so trace it on the Varnish side:

```bash
# Watch BAN requests live as you reproduce an action
varnishlog -g request -q 'ReqMethod eq "BAN"'

# Inspect currently active bans — a fast-growing list, or any pattern that is
# just ".*" (matches everything), is the same "flush-all" anti-pattern as mode=all above
varnishadm ban.list
```

A `.*` pattern (or a pattern far broader than the tags of the entity actually saved) means the whole cache was purged for one change. To trace which PHP code issued that specific BAN, use the same temporary diagnostic plugin from branch A — Varnish purges still originate from the same `CacheInterface`/`clean_cache_by_tags` call path in Magento before the BAN request goes out.

### Interpreting results

| Signal | Pattern | Severity |
|--------|---------|----------|
| Full/blanket flush | debug.log entry whose tags are **only** the bare type tag (e.g. `["FPC"]` alone, no entity tag alongside it), or `X-Magento-Tags-Pattern: .*` in varnishlog/ban.list | High |
| Over-broad tag scope | Tag list clears far more than the entity actually changed (e.g. clearing every `cat_p_*` tag for a single product save) | Medium-High |
| Flush tied to non-rendering fields | Invalidation fires on saving a field never used in any cacheable block's `getIdentities()`/cache tags | Medium |
| Untraceable / scheduled flush | Repeated clean/BAN entries with no corresponding admin/API save nearby — often a cron job or deploy script calling `cache:flush` on a timer "just in case" | High |
| Duplicate flush per save | The same tag set logged more than once within seconds of one single save — rule out an async reindex re-invalidating the same tag shortly after (expected) before calling it a redundant custom observer (a bug) | Low-Medium |

> Flush frequency should scale with save/import volume, not run on a fixed schedule unrelated to actual content changes. If `cache:flush`/`cache:clean` shows up in a cron job or deploy script "just to be safe," that's a scheduled full flush independent of whether anything relevant even changed — treat it the same as a bare-type-tag finding above.

## Client-Side AJAX Request Load Audit

A page can pass every check above — `full_page` cache enabled, invalidation narrowly scoped — and still overload the backend, because `full_page` only caches the initial HTML response. Customer data (private content), GraphQL calls, and custom AJAX endpoints are session/customer-scoped, so they bypass FPC entirely and hit PHP-FPM/the database on **every single page view**, cached HTML or not. This matters more than it used to: modern crawlers (SEO bots, AI scrapers, headless-Chrome-based tools) execute JS the same way a real browser does, so every page they crawl re-fires the same AJAX calls a human visitor would — a site can look fully cached in every metric above and still fall over under crawl volume, because the part that's actually uncached is invisible to an HTML/query-count audit.

> **Confirm this project actually uses the sections.xml/Customer Data pattern before leaning on §2 below.** Some Magento builds replace it partly or fully with a different reactive layer — a Livewire-style library (e.g. Magewire), a PWA/headless frontend, or GraphQL-driven state — where cart/customer widgets update through a different mechanism entirely, and a wildcard-rule check on `sections.xml` won't surface much because there's barely any `sections.xml` usage to begin with. Quick check: `find app/code vendor -iname sections.xml | wc -l` and a grep for the reactive library's own component base class under `app/code`. If it's low/near-zero, rely on the network capture in §1 instead — look for that other mechanism's own request pattern using the same "same-origin, repeated, sets a new session cookie" signals used below.

### 1. Capture the AJAX footprint of a representative page

Do this for **each of the 3 page types** from the Per-Page-Type Audit (homepage, product, category) — same rationale: the AJAX footprint differs by page type just as much as the query/profiler footprint does, and a homepage-only check can miss the worst offender entirely (a real audit found the homepage firing one same-origin call, while the product page on the same site fired six distinct same-origin endpoints — the two page types are not interchangeable samples).

Open Chrome DevTools > Network, filter to Fetch/XHR, and load the page **in incognito / with site data cleared** — this simulates what an anonymous visitor (or crawler) sees, not a footprint inflated or deflated by your own logged-in dev session.

> **Watch specifically for `/customer/section/load` with an empty `sections` parameter** (`?sections=`). Magento has a long-standing quirk where an empty `sections` filter returns **every** registered section rather than none — including the full cart, checkout eligibility, and the complete worldwide country/region directory used by address forms. What looks like the cheapest, most trivial call on the page can silently be the single most expensive uncached response it makes. Check the actual response body size/content, not just the request URL, before dismissing it.

- Count same-origin (your Magento domain) requests separately from third-party ones — only same-origin requests add load to your server; a Facebook/Google pixel call goes straight to their servers and isn't a Magento capacity concern (unless the project has a custom server-side tracking proxy — e.g. a controller relaying Conversion API/Measurement Protocol events — in which case treat that controller like any other custom AJAX endpoint below). In practice, on a real storefront this list is often dominated by third-party marketing tags (chat widgets, popups, review widgets, ad pixels) — don't let their volume distract from the (usually much smaller) same-origin count, which is the one that matters here.
- For each same-origin XHR/fetch, check its response headers — anything `Cache-Control: private`/`no-store` (Magento surfaces this as `X-Magento-Cache-Debug: MISS` / `X-Magento-Cache-Control: ..., no-store` on its own responses) is a call that hits the backend fresh every time, unlike the FPC-served HTML.
- Watch for the *same* same-origin endpoint firing more than once per page load, especially if each call sets a **new** `Set-Cookie: PHPSESSID=...` — that means each occurrence is opening its own PHP session server-side, doubling (or worse) the real backend cost of a single page view.

Common first-party culprits to look for: `/customer/section/load` (private content / Customer Data), `/graphql` (if any theme/PWA component fetches client-side), custom wishlist/compare/stock-check/price AJAX endpoints, any custom analytics/tracking proxy controller, and — easy to miss — **third-party marketing/personalization integrations (Connectif, Klaviyo, Nosto, etc.) that ship their own customer/cart-context controller** to sync cart/login state into their widget. These sit entirely outside `sections.xml`/Magento's private-content system, so auditing §2 below won't catch them — only the network capture in this step will.

### 2. Audit `sections.xml` for overly broad Customer Data invalidation

`sections.xml` declares which Customer Data sections must be invalidated (forcing a `/customer/section/load` reload) after specific controller actions. A wildcard or over-broad rule forces **every** unrelated action to reload the **full** section list, not just what actually changed — the most common cause of a `/customer/section/load` reload storm.

```xml
<!-- WRONG - "*" invalidates ALL sections on ANY controller action -->
<action name="*">
    <section name="cart"/>
    <section name="customer"/>
    <section name="wishlist"/>
    <section name="compare-products"/>
    <section name="review"/>
</action>

<!-- CORRECT - scope invalidation to only the sections that action actually affects -->
<action name="checkout_cart_add">
    <section name="cart"/>
</action>
<action name="wishlist_index_add">
    <section name="wishlist"/>
</action>
```

```bash
# Find wildcard/broad invalidation rules across custom and third-party modules
grep -rn '<action name="\*"' app/code vendor/*/module-*/etc/frontend/sections.xml 2>/dev/null
```

> Magento core itself ships one wildcard rule (`vendor/magento/module-theme/etc/frontend/sections.xml`, `<action name="*"><section name="messages"/></action>`) — that one is expected and cheap (a single lightweight section on every action). It's not the anti-pattern; the anti-pattern is a wildcard rule reloading several/heavy sections. When grepping, check what's actually declared inside each match before flagging it — don't flag on the wildcard alone.

Also check custom JS for widgets that force their own reload instead of relying on the invalidation-rule-driven one — this duplicates whatever `sections.xml` already triggers for the same user action:

```javascript
// WRONG - forces a reload of everything on every click, on top of whatever
// the sections.xml invalidation rule for this action already reloads
$('.some-widget').on('click', function () {
    customerData.reload(['cart', 'customer', 'wishlist'], true);
});

// CORRECT - let sections.xml own invalidation for rule-covered sections;
// only call reload() explicitly for a section with no matching action rule,
// and scope it to just that section
customerData.reload(['wishlist-widget-count'], false);
```

## Code-Level Performance Patterns

### Scanning `app/code` for These Patterns

Don't rely on reading through custom modules by eye — grep for the shapes below across custom code first (scope to `app/code`, not `vendor/`, so results are actually yours to fix; see the vendor-code note under Common Query Issues above for anything that turns up in a third-party extension instead):

```bash
# N+1: a ->load()/->create()->load() call sitting inside a foreach loop
grep -rnE 'foreach\s*\(' --include="*.php" app/code -A3 | grep -B3 -- '->load('

# Full collection load just to count items (should be ->getSize() instead)
grep -rn 'count(\$.*[Cc]ollection' --include="*.php" app/code

# Blocks marked uncacheable (prevents FPC for whatever layout handle references them)
grep -rl 'cacheable="false"' --include="*.xml" app/code
```

The `foreach`/`->load()` grep is a heuristic, not a proof — read each hit to confirm it's actually iterating a list (a false positive: a single `->load()` inside a `foreach` that only ever runs once). For the `cacheable="false"` grep, check what page/layout handle it's declared under before flagging it — Magento's own core layout XML uses it by default on inherently personalized pages (customer account, checkout, wishlist, order history), where it's correct and expected, not a bug.

### N+1 Query Detection (From magento2-dev-core)

```php
// WRONG - N+1 query
foreach ($productIds as $id) {
    $product = $this->productFactory->create()->load($id); // Query per iteration
    $result[] = $product->getName();
}

// CORRECT - Batch load
$collection = $this->productCollection->create()
    ->addFieldToFilter('entity_id', ['in' => $productIds]);
foreach ($collection as $product) {
    $result[] = $product->getName();
}
```

### Collection Counting

```php
// WRONG - Loads all items
$count = count($this->collection->create()->getItems());

// CORRECT - Lightweight count query
$count = $this->collection->create()->getSize();
```

### Uncacheable Blocks

```xml
<!-- WRONG - Prevents FPC -->
<referenceBlock name="content" cacheable="false">
    <!-- This block will prevent full page caching -->
</referenceBlock>

<!-- CORRECT - Use esi:inline directive if needed -->
<referenceBlock name="dynamic.block" template="Magento_Cms::dynamic.phtml">
    <arguments>
        <argument name="cache_lifetime" xsi:type="number">3600</argument>
    </arguments>
</referenceBlock>
```

### Heavy Constructors

```php
// WRONG - Expensive operation in constructor
public function __construct(
    private readonly ExpensiveApiService $expensiveService
) {
    // This runs every time the class is instantiated
    $this->data = $this->expensiveService->fetchData();
}

// CORRECT - Lazy initialization via Proxy
public function __construct(
    private readonly ExpensiveApiServiceProxy $expensiveService
) {}

public function getData(): array
{
    if ($this->data === null) {
        $this->data = $this->expensiveService->fetchData();
    }
    return $this->data;
}
```

### Inefficient Cache Invalidation

```php
// WRONG - blanket flush on every save, regardless of what actually changed
class FlushFullPageCache implements ObserverInterface
{
    public function execute(Observer $observer): void
    {
        $this->cacheTypeList->cleanType(\Magento\PageCache\Model\Cache\Type::TYPE_IDENTIFIER); // clears ALL of full_page
    }
}

// WRONG - "just in case" full flush from a cron job or deploy script,
// unconditional and unrelated to whether anything relevant changed
// bin/magento cache:flush

// CORRECT - targeted invalidation scoped to the entity that actually changed
public function execute(Observer $observer): void
{
    $product = $observer->getEvent()->getProduct();
    $this->cache->clean(
        \Zend_Cache::CLEANING_MODE_MATCHING_TAG,
        [\Magento\Catalog\Model\Product::CACHE_TAG . '_' . $product->getId()]
    );
}

// EVEN BETTER - don't add a parallel custom flush at all; make sure the
// affected block/data actually participates in the entity's native getIdentities()
// cache tags, so Magento's own save-time invalidation already covers it
```

## Cron Health Check

```bash
# Verify cron is running
govard sh -c "crontab -l | grep magento"

# Check cron_schedule table
govard sh -c "bin/magento cron:install"

# Manual cron run for testing
govard sh -c "bin/magento cron:run --group=default"
```

| Cron Group | Schedule | Purpose |
|------------|----------|---------|
| default | Every minute | Low priority tasks |
| index | Every minute | Indexer updates |
| consumers | Every minute | Message queue |

## Security Probes

### Exposed Files Check

```bash
# Check for sensitive file exposure
curl -s https://store.test/app/etc/env.php | head -20
curl -s https://store.test/composer.json | head -20
curl -s https://store.test/.git/config 2>/dev/null
```

### Debug Headers & Version Disclosure

```bash
# Check for information leakage — debug/profiler headers AND server/version disclosure
curl -I https://store.test/ | grep -iE "x-.*debug|x-.*profile|^server:|x-powered-by"

# Expected: no debug headers, and Server/X-Powered-By should not reveal exact
# nginx/PHP versions in production (server_tokens off; expose_php = Off)
```

## Audit Report Template

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

## Workflow

**When invoked:**
1. Execute infrastructure checks (env.php, mode, cache status) — first confirm whether the target is local dev, staging, or production, since expectations differ (see note under Infrastructure Configuration)
2. Run indexer status check, and verify cron is actually running/draining `cron_schedule`
3. Run the Per-Page-Type Audit — homepage plus 3 category (small/medium/large) and 3 product URLs — with `full_page`/`block_html`/`layout` caches disabled — verify each test page is representative first (§0), then capture profiler + query log together (§1–2), watch for a query count that scales with grid size across the 3 category samples, then restore state (§3)
4. Run Slow Query Analysis (app-level `TIME:` sort, and/or MySQL's own slow_query_log for cron/import-triggered queries the app-level log can't see) — `EXPLAIN` any candidate before reporting it, and turn slow_query_log back off when done
5. Trace cache invalidation efficiency — enable temporary logging (debug.log for built-in Redis/file FPC, varnishlog/ban.list for Varnish), reproduce one isolated save/action (or mark unverified if no admin credentials are available this session), and flag any custom code causing broad/frequent flushes beyond Magento's default targeted invalidation
6. Confirm which reactive/AJAX mechanism the project actually uses (sections.xml/Customer Data vs. Magewire/PWA/GraphQL or similar), then capture the AJAX footprint of a fresh/anonymous page load (Network tab) and audit accordingly — for sections.xml, check for overly broad Customer Data invalidation rules; these uncacheable requests are what crawler/bot JS execution multiplies regardless of FPC hit rate
7. Run Core Web Vitals audit (Chrome DevTools MCP trace preferred, Lighthouse as fallback) — when render delay dominates an LCP, read it per the JS-hydration guidance under Core Web Vitals Audit rather than assuming a network/image problem
8. Scan `app/code` for code-level performance patterns using the grep recipes under Code-Level Performance Patterns
9. Generate report with recommendations, prioritizing any finding that repeats across all 3 page types (site-wide impact) over page-specific ones — publish as a rendered artifact if the environment supports it (see Audit Report Template), otherwise markdown