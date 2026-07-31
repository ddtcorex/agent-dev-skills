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
> 3. **Confirm the URL you're about to test is actually the target, not a same-named remote.** In a multi-environment shop (local Docker + staging + production sharing similar hostnames), a project's own `core_config_data`/`env.php` `base_url` can be stale — copied over from a staging/production sync — and point at a completely different server than the container you're running `govard sh`/`govard db` commands against. A `curl` to that stale URL still returns 200 with valid-looking Magento HTML and headers (including a real `X-Magento-Cache-Debug`), so nothing *looks* wrong — every query-log/profiler capture that follows is then silently empty (wrong box entirely) or measuring someone else's environment. Get the real local hostname from the environment tooling itself (e.g. `govard open admin` prints it) rather than trusting `base_url` blindly, and sanity-check with `curl -skI <url> | grep -i x-backend-server` — confirming it maps to the same box you're running commands against before capturing anything.

## Query Count: Tiers, Not a Pass/Fail Gate

A flat "under 80 on homepage, under 150 on category/product" number looks precise but isn't realistic for a real commerce Magento build. Vanilla Magento might hit those numbers, but a project with a typical real-world extension stack — payment gateways, GDPR/compliance, personalization, sorting/merchandising, feeds, the kind of thing every serious Magento business runs — routinely adds its own per-extension query overhead on top, and there's no single number that separates "healthy stack of extensions" from "one of them has a bug." Read the total as a tiered signal instead:

| Range | Read |
|-------|------|
| 50–150 | Vanilla/near-vanilla Magento |
| 150–500 | Typical for a handful of extensions — review the top repeated shapes, don't assume it's fine just because it's under some number |
| 500–1,500 | Heavy extension stack — investigate the top 5 repeated shapes specifically; may be legitimate cumulative cost or may hide a bug |
| 1,500+ | Almost certainly one or more real N+1 bugs on top of extension overhead, not extension overhead alone |

**Establish a project-specific baseline instead of judging against a universal number.** The first time you audit a project, capture the query count as-is (after fixing anything the audit finds) and record it as that project's baseline. On every subsequent audit, compare against *that* baseline, not the table above — a regression from 400 to 900 matters regardless of which tier both numbers fall in, and a number that's always been 900 is a different conversation from a fresh spike to 900. The tiered table is a starting point for a project with no recorded baseline yet; the baseline is what actually matters once one exists.

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

> **Two-pass strategy keeps log volume sane.** `--include-call-stack=true` walks and serializes a full PHP stack trace for *every* query — several MB per page, and that compounds fast once you're capturing 3 page types (see `references/per-page-type-audit.md`). Run pass 1 with `--include-call-stack=false` (or just omit repeated shapes/counts are all you need to spot an N+1 candidate) across every page you're auditing; only re-enable `--include-call-stack=true` for a second, targeted re-capture of the specific page(s) whose repeated shape you're now tracing to a file:line. Stack-walking every page from the start is the slower, heavier default — reserve it for the one or two pages that actually need it.

## Common Query Issues

| Issue | Pattern | Impact |
|-------|---------|--------|
| N+1 Query | `foreach` with `->load()` inside, or the same normalized query shape (ignore literal values) appearing dozens of times in `var/debug/db.log` for one page load | High |
| Full Collection Load | `count($collection)` | Medium |
| Missing Index | `WHERE unindexed_column` | High |
| Expensive Join | Multiple JOINs on large tables | Medium |

> **Check the call stack's namespace before deciding how to fix.** A repeated query traced back to `vendor/<vendor-name>/...` (a paid extension, not `vendor/magento/`) isn't yours to patch directly — check for a newer version of that extension first, and if none fixes it, wrap the offending call with a request-level memoization layer (a plugin/decorator that caches the result for the current request) rather than editing vendor code, which a composer update will silently overwrite.

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

## HTML Profiler (per-request timing breakdown)

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
