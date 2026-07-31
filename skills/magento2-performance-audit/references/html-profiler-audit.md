# HTML Profiler (per-request timing breakdown)

Full detail for Workflow step 3 — captured alongside the query log during the Per-Page-Type
Audit, but a genuinely different signal from `references/database-query-profiling.md`: this
profiles PHP block/template execution time, not SQL. A page can have a perfectly healthy query
count and still be slow because a custom block's own PHP logic (not a query) is expensive — a
heavy constructor, per-item computation inside a template loop, a synchronous external API call
made during render. This is frequently the *only* place that kind of cost is visible, since it
never shows up in a query log at all if the expensive work isn't itself a database call.

## Enabling and capturing

```bash
# Enable the code profiler with HTML output
govard sh -c "bin/magento dev:profiler:enable html"

# IMPORTANT: the profiler only activates if the request's Accept header contains "text/html" —
# a bare `curl -s` without this header will produce NO profiler output at all (this is checked
# in app/bootstrap.php). Always include it, along with a realistic UA/Accept (see the warning in
# references/database-query-profiling.md) and a status check:
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

## Reading the table: what each column actually means

- **Timer Id** — a `->`-nested path built from Magento's own instrumentation naming; the
  deepest custom-namespace segment in the path tells you which class actually owns the cost.
- **Time** — cumulative wall-clock time for that timer across *all* its invocations this
  request, not per-call. A high-`Cnt`/low-`Avg` timer can sum to the same `Time` as a
  low-`Cnt`/high-`Avg` one — sort by `Time` first to find the biggest contributors, then check
  `Cnt`/`Avg` to tell those two cases apart, since the fix is different for each.
- **Avg** — `Time / Cnt`. A timer with `Cnt: 1` and a high `Avg` is a single expensive
  operation — this is where the Heavy Constructor pattern from `references/code-level-patterns.md`
  actually shows up: a high `Avg` on a block's own instantiation/render timer, with nothing to
  see in the query log if the expensive work isn't a DB call (a synchronous API request, a
  non-trivial computation).
- **Cnt** — how many times that exact timer fired. A timer with a high `Cnt` (dozens+) on a
  single page load, especially a `_toHtml`/render-per-item pattern, is the profiler's version of
  the query log's repeated-query-shape signal — the same "per-item work that should be batched"
  bug class, visible here instead of (or in addition to) the query log.

## Finding custom-code cost, not just the single worst row

Sort the profiler table by `Time` descending and read down until entries fall into
`vendor/magento/` namespaces — everything above that point is either custom code (`app/code`, a
paid extension under `vendor/<vendor-name>/`) or Magento core work inflated by custom code
calling it more than necessary (e.g. a plugin wrapped around a core method that adds its own
loop). Don't stop at the first row: a single custom block near the top is easy to spot, but a
custom plugin wrapping a *core* method — so the core method's own timer absorbs the extra cost —
is easy to miss unless you check whether a core timer's `Cnt` or `Avg` looks unusually high for
what that method should normally cost.

Cross-reference the same "vendor code isn't yours to patch directly" rule from
`references/database-query-profiling.md` — a slow timer traced into a paid extension's own
`vendor/<vendor-name>/` code needs the same vendor-update-or-request-level-memoization approach
as a slow query from the same source, not a direct edit.

## The same cross-page-type signals apply here as in the query log

Compare the profiler table across all 7 captured pages (see
`references/per-page-type-audit.md`), the same way the query log gets compared:

- A timer that's slow **on every page type** (not just one) points to a globally-rendered block
  (header/footer/cart-drawer widget) — fix it once for site-wide impact, same priority logic as
  a globally-repeated query shape.
- A timer whose `Cnt` (or `Time`) scales with the small/medium/large category samples is a
  per-item render loop that gets worse as the catalog grows — the profiler-side equivalent of
  the size-scaling N+1 diagnostic, and just as invisible to a single-category spot check.

## Report every meaningful timer, not just the single worst offender

Populate the Slowest Blocks/Templates table in the Audit Report Template
(`references/report-template.md`) with every timer using more than ~5% of that page's total
time (via the root `magento` timer), or firing double-digit-or-higher `Cnt` — not just the one
dramatic outlier. A page can have one obvious slow block and several smaller-but-still-custom
contributors that only add up to a real problem when looked at together; reporting only the top
row misses that pattern the same way reporting only one Repeated Query Shape would.
