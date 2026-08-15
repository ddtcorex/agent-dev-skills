# Database Query Profiling

Full detail for Workflow step 3 (query counting) and step 4 (Slow Query Analysis).

> **Always verify what you actually captured, not just that curl returned something.** A `curl` with a bare `Accept: text/html` and no `User-Agent` (curl's own default) does not behave like a real browser request on every project — on one real audit, that exact combination silently routed into a REST/webapi content-negotiation edge case and returned a fatal 500 error page instead of the real page, on every single page type, while a real browser hitting the identical URL got a normal 200. The captured body still "looked like" a page (it had HTML, a stack of queries, a profiler table) — nothing about the capture itself signaled failure. The query counts from that 500 page were reported as real findings and were wrong by 20–70×. Two non-negotiable habits prevent this:
> 1. **Check the HTTP status code on every captured request** (`-w "%{http_code}"`) and treat anything other than 200 as a failed capture, not data — never analyze a body you haven't confirmed the status of.
> 2. **Use a realistic browser `Accept` header and `User-Agent`**, not framework-minimum ones, so the request exercises the same code path a real visitor hits:
>    ```bash
>    UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
>    ACCEPT="text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
>    ```
>    Every `curl` command below assumes these two variables are set first.
> 3. **Confirm the URL you're about to test is actually the target, not a same-named remote — and check the *effective* `base_url`, not just what's in the database.** In a multi-environment shop (local Docker + staging + production sharing similar hostnames), a project's own `base_url` can be stale — copied over from a staging/production sync — and point at a completely different server than the container you're running `govard sh`/`govard db` commands against. **Don't rely on a raw `core_config_data` query for this** (`SELECT value FROM core_config_data WHERE path='web/unsecure/base_url'`) — Magento resolves config through a precedence chain (env vars → `app/etc/env.php` locked config, e.g. from `bin/magento config:set --lock-env` → `core_config_data` → `config.xml` defaults), and a value locked in `env.php` or set via a `CONFIG__DEFAULT__WEB__UNSECURE__BASE_URL`-style env var silently overrides whatever the DB shows, making a DB-only check report a value the running application isn't actually using. Use `bin/magento config:show web/unsecure/base_url` instead — it resolves the full chain the same way a real request does. A `curl` to a stale URL still returns 200 with valid-looking Magento HTML and headers (including a real `X-Magento-Cache-Debug`), so nothing *looks* wrong — every query-log/profiler capture that follows is then silently empty (wrong box entirely) or measuring someone else's environment. Get the real local hostname from the environment tooling itself (e.g. `govard open admin` prints it) rather than trusting either source blindly, and sanity-check with `curl -skI <url> | grep -i x-backend-server` — confirming it maps to the same box you're running commands against before capturing anything.
> 4. **Don't trust a single reading that looks like an outlier, especially the first page captured right after `cache:flush`/the warmup request.** On one real audit, the very first per-page capture (the homepage, first in the loop) showed a bizarre one-time burst — four query shapes (`SELECT store.*`, `SELECT store_group.*`, `SELECT store_website.*`, `SET NAMES ...`) each repeated ~210 times, reading like a real N+1/reconnect storm. Re-running that exact same page capture 4 independent times (with cron ruled out — `cron_schedule` was empty and there was no crontab in the container) consistently returned a much lower, stable count; the burst never came back. The likely mechanism: the *previous* request (the warmup, or whichever request ran right before a truncate-then-capture step) can still be writing to `var/debug/db.log` at PHP-FPM shutdown a moment after it already returned its HTTP response to curl — if that write lands after you've truncated the log for the *next* capture, the next page's count silently absorbs the previous request's tail. Before recording any number that looks unusually high (or reporting it as a project's baseline — see below), re-run that one page's capture 2–4 times in isolation. If it doesn't reproduce, the original reading was capture noise, not a finding — say so explicitly in the report rather than quietly substituting the corrected number with no explanation.
> 5. **A single homepage warmup does not warm every sample page — each distinct URL pays its own first-visit-since-flush cold cost.** On a different real audit, a full 7-page pass (1 homepage warmup, then capture all 7) produced wildly unreproducible counts across repeated passes — the same category page read 321, then 676, then 320, then 236 across separate runs, with no cron/consumer/daemon activity to blame (confirmed via a 5-second idle window with zero queries logged while no request was in flight). Isolating a single page and hitting it repeatedly revealed the real mechanism: right after `cache:flush`, that page's *own* first hit cost 370 queries (rebuilding layered-nav attribute metadata and other page-type-specific lookups that a homepage visit never touches), then every hit after that — regardless of what other pages were visited in between — stayed at a stable 236. Warming the homepage warms only what the homepage itself touches. **Warm every sample URL individually** (see `references/per-page-type-audit.md`) before its own real capture, not just the homepage once at the start.

## Query Count: Tiers, Not a Pass/Fail Gate

A flat "under 80 on homepage, under 150 on category/product" number looks precise but isn't realistic for a real commerce Magento build. Vanilla Magento might hit those numbers, but a project with a typical real-world extension stack — payment gateways, GDPR/compliance, personalization, sorting/merchandising, feeds, the kind of thing every serious Magento business runs — routinely adds its own per-extension query overhead on top, and there's no single number that separates "healthy stack of extensions" from "one of them has a bug." Read the total as a tiered signal instead:

| Range | Read |
|-------|------|
| 50–150 | Vanilla/near-vanilla Magento |
| 150–500 | Typical for a handful of extensions — review the top repeated shapes, don't assume it's fine just because it's under some number |
| 500–1,500 | Heavy extension stack — investigate the top 5 repeated shapes specifically; may be legitimate cumulative cost or may hide a bug |
| 1,500+ | Almost certainly one or more real N+1 bugs on top of extension overhead, not extension overhead alone |

**Establish a project-specific baseline instead of judging against a universal number.** The first time you audit a project, capture the query count as-is (after fixing anything the audit finds), confirm it's reproducible (items 4–5 above — every sample URL warmed individually, and any number that still looks off re-run before trusting it), and record it as that project's baseline. On every subsequent audit, compare against *that* baseline, not the table above — a regression from 400 to 900 matters regardless of which tier both numbers fall in, and a number that's always been 900 is a different conversation from a fresh spike to 900. The tiered table is a starting point for a project with no recorded baseline yet; the baseline is what actually matters once one exists.

The repeated-shape and cross-page-type signals elsewhere in this skill remain the primary diagnostic either way — they tell you *what* to fix regardless of which tier the total falls into.

## DB Query Log Setup

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

### Capture integrity and query attribution

`db.log` is process-shared: cron/consumer traffic and shutdown writes can enter a
capture after `curl` returns. A `grep -c` is therefore provisional. For each page,
clear the log, allow prior writes to settle, make one request, wait again, copy the log, then
disable and clear logging. With call stacks enabled, split at the timestamp header and retain only
`## ... ## QUERY` records whose *complete multi-line record* contains
`Magento\\Framework\\App\\Http`; a line-oriented `TRACE:.*App\\Http` regex misses valid frontend
records.

Compare before/after query counts only for the same effective URL (path, query string,
pagination, store/currency/customer context), request headers, cache state, and product
composition. Record the URL and displayed product count. A differently composed category
or widget page is a separate sample, not evidence of a regression.

Trace each repeated shape from the SQL resource method to the first semantic caller, then compare
any plugin or template override with core. Label the result **core behavior**,
**customization-triggered**, or **customization-amplified**; a custom namespace in an interceptor
stack alone proves none of these. For bundle listings, Magento's
`DefaultSelectionPriceListProvider` can load selections per bundle option. An `isSalable()` plugin
seen after that query is not its cause; inspect any `Magento_Bundle` price-template override to
determine whether it adds price calls or merely renders a bundle-heavy product mix before choosing
a batch preload or rendering change.

> **Two-pass strategy keeps log volume sane.** `--include-call-stack=true` walks and serializes a full PHP stack trace for *every* query — several MB per page, and that compounds fast once you're capturing 3 page types (see `references/per-page-type-audit.md`). Run pass 1 with `--include-call-stack=false` (or just omit repeated shapes/counts are all you need to spot an N+1 candidate) across every page you're auditing; only re-enable `--include-call-stack=true` for a second, targeted re-capture of the specific page(s) whose repeated shape you're now tracing to a file:line. Stack-walking every page from the start is the slower, heavier default — reserve it for the one or two pages that actually need it.

## Common Query Issues

| Issue | Pattern | Impact |
|-------|---------|--------|
| N+1 Query | `foreach` with `->load()` inside, or the same normalized query shape (ignore literal values) appearing dozens of times in `var/debug/db.log` for one page load | High |
| Full Collection Load | `count($collection)` | Medium |
| Missing Index | `WHERE unindexed_column` | High |
| Expensive Join | Multiple JOINs on large tables | Medium |

> **Check the call stack's namespace before deciding how to fix.** A repeated query traced back to `vendor/<vendor-name>/...` (a paid extension, not `vendor/magento/`) isn't yours to patch directly — check for a newer version of that extension first, and if none fixes it, wrap the offending call with a request-level memoization layer (a plugin/decorator that caches the result for the current request) rather than editing vendor code, which a composer update will silently overwrite.

> **Report every repeated shape past the threshold, not just the ones you're confident are bugs.** "Dozens of times" above is a signal for *severity* (High), not a bar for *inclusion in the report* — a shape repeated only 6-10 times might be a legitimate per-block cost, or might be an early-stage N+1 that gets much worse as the catalog/data grows (see the size-scaling diagnostic in `references/per-page-type-audit.md`). List anything repeated more than ~5 times per page load in the Audit Report Template's Repeated Query Shapes table (`references/report-template.md`) and let that table's Assessment column carry the judgment call — don't silently drop a borderline case from the report because it doesn't look like a clear bug yet.

> **The Repeated Query Shapes table (>5 threshold) is not a substitute for the full Per-Page Query Detail breakdown — both are required.** Every database-profiling report must also include, for each of the 7 captured pages, the *complete* list of distinct normalized query shapes that ran on that page load with their counts — not filtered to the >5 threshold. This is a standing report component (see `references/report-template.md`), not something to add only when a reader happens to ask for it: it's what turns a one-off audit into reusable reference documentation for the project (what does this page type actually query, so a later regression is obvious by diff rather than by memory).

## Known Core-Magento Pattern: Configurable-Parent Lookup Gated by an Unrelated Config Flag

On one real audit (zero `configurable`-type products in the catalog), this shape repeated 48–316×/page, every call returning `AFF: 0`:

```
SELECT e.entity_id FROM catalog_product_super_link AS l
  INNER JOIN catalog_product_entity AS e ON e.entity_id = l.parent_id
  WHERE (l.product_id IN(?))
```

> **Assumes no DB table prefix** — see the callout in `references/per-page-type-audit.md`. If set, the grep below needs the same prefix or it silently returns 0 matches, reading as "doesn't apply here."

"Catalog has no configurable products, so it's pure waste" is correct but incomplete — tracing call stacks showed **two unrelated core plugins converge on the same resource-model method**:

| Caller | Share | Trigger |
|---|---|---|
| `Magento\Weee\Plugin\Model\ConfigurableVariationAttributePriority` | 89% | `tax/weee/enable=1` — unrelated to configurable products at all |
| `Magento\ConfigurableProduct\Model\Plugin\ProductIdentitiesExtender` | 11% | Always active (FPC cache-tag collection) |

Both call `Configurable::getParentIdsByChild()` with no early-exit for "does this store have configurable products." **Get the full caller distribution before fixing** — stopping at the first plugin traced would have left 89% of the waste in place:

```bash
# Requires --include-call-stack=true. Frame #4 is the direct caller.
grep -A5 "FROM \`catalog_product_super_link\` AS \`l\`" var/debug/db.log \
  | grep -oE '#4 [^(]+\([0-9]+\): [A-Za-z0-9_\\]+->[A-Za-z0-9_]+' | sort | uniq -c | sort -rn
```

Confirmed this is core behavior, not project-specific, by toggling `tax/weee/enable` on vanilla Luma sample data with caches disabled: a 9-product category went 0 → 1 wasted call/product. Check `bin/magento config:show tax/weee/enable` as a standing step whenever this shape shows up — "no configurable products" alone under-counts the fix's impact.

**Fix:** a project-level plugin at the resource-model boundary (not either individual caller — vendor code, no version to upgrade to):

```php
// Plugin on Configurable::getParentIdsByChild()
public function aroundGetParentIdsByChild($subject, callable $proceed, $childId)
{
    if (!$this->hasConfigurableProducts()) {   // request-memoized SELECT ... WHERE type_id='configurable' LIMIT 1
        return [];
    }
    return $proceed($childId);
}
```

Memoize **per request only** — self-healing the moment a configurable product is added, with zero stale-cache logic to maintain.

## Known Core-Magento Pattern: Tier-Price / Catalog-Rule-Price Fires Once Per Displayed Product

These two shapes repeated 13→46→46 across small/medium/large category samples (46 = the store's `catalog/frontend/grid_per_page`, not the category's product count):

```
SELECT catalog_product_entity_tier_price.* WHERE website_id=? AND entity_id=? ORDER BY qty ASC
SELECT catalogrule_product_price.product_id, rule_price WHERE rule_date=? AND website_id=? AND customer_group_id=? AND product_id IN(?)
```

The call stack traced into a project's own `aroundGetValue()` pricing plugin, reported as root cause. **Wrong.** The plugin is structurally identical to core's own `BasePrice::getValue()` (same loop, same `min()` pattern) — the real mechanism is Magento-native: `Layer\Category\CollectionFilter` already calls `addFinalPrice()` by default, which joins `catalog_product_index_price` and sets `tier_price` to a scalar or `NULL` — but `TierPrice::getStoredTierPrices()` requires `is_array()`, so its fallback query fires regardless of whether `addFinalPrice()` ran. `catalog_rule_price` isn't in that join's column list at all, so it always falls back too. Confirmed on a vanilla install too (9–24/page, same scaling); the count gap vs. the audited project was `catalog/frontend/grid_per_page` being ~2x, not a code difference.

**Before naming an `around` plugin as root cause, diff it against the core method it wraps** — an `around` plugin that never calls `$proceed()` looks fully responsible from the call stack alone, but if its loop matches core's, the custom code isn't adding cost. Check `catalog/frontend/grid_per_page`/`list_per_page` before comparing counts across stores.

**Fix** — batch-load once per grid via the `hasData()` escape hatch both price models already check:

```php
// afterGetLoadedProductCollection() on Magento\Catalog\Block\Product\ListProduct
$collection->addTierPriceData(); // core's own batch method

$productIds = [];
foreach ($collection->getItems() as $item) {
    if (!$item->hasData('catalog_rule_price')) {
        $productIds[] = (int)$item->getId();
    }
}
if ($productIds) {
    $rulePrices = $this->ruleResource->getRulePrices($date, $websiteId, $groupId, $productIds); // Rule::getRulePrices()
    foreach ($collection->getItems() as $item) {
        if (!$item->hasData('catalog_rule_price')) {
            $item->setData('catalog_rule_price', $rulePrices[$item->getId()] ?? false);
        }
    }
}
```

See `references/code-level-patterns.md`'s FPC-safety section for the session-read gotcha this fix runs into.

## Slow Query Analysis

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

## Block/template timing is a separate signal

Query count and query time only cover SQL — a page can be slow because of expensive *PHP* work
in a block or template (a heavy constructor, per-item template logic, a synchronous API call)
that never touches the database at all, and none of the above will show it. That's a distinct
signal captured via the HTML profiler during the same page load — see
`references/html-profiler-audit.md` for how to enable it, read the timing table, and trace
custom-code cost.
