# Per-Page-Type Audit (homepage, product, category)

Full detail for Workflow step 3.

A single-page spot check isn't representative — different page types have very different bottleneck shapes (a CMS-heavy homepage vs. a layout-heavy product page vs. a grid-heavy category page). Audit at least one of each of these three page types, using both the HTML profiler (`references/html-profiler-audit.md`) and the query log (`references/database-query-profiling.md`) together, with `full_page`, `block_html`, and `layout` caches **disabled** so you're measuring true cache-miss cost (the worst case every real cache-miss/deploy/flush pays) rather than a warm-cache request that tells you almost nothing.

**Sample 3 URLs per page type, not 1 — except homepage, which is usually singular** (unless the store has multiple storefront views, in which case sample those too). One category and one product tells you *a* number; it can't tell you whether that number is representative of the type or an artifact of the one page you happened to pick, and it can't catch a bug whose cost only becomes visible at scale (see "Interpreting results correctly" below — it needs at least 3 differently-sized samples of the same type to work at all). Three samples per type is enough to show a pattern without turning the audit into a full crawl.

## 0. Pick genuinely representative pages first

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

## 1. Set up the uncached measurement environment

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

## 2. Capture each page type separately

For each of the (typically 7: 1 home + 3 category + 3 product) URLs, clear the query log, fetch with a realistic `Accept`/User-Agent (see warning in `references/database-query-profiling.md`), save the HTML (for the profiler table) and a copy of the query log, then clear the log again before the next page — **checking the HTTP status every time**, since a non-200 response still produces a plausible-looking HTML file and query log that will silently corrupt every number downstream if you don't check:

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

Analyze each page's `*.html` for its profiler table (see `references/html-profiler-audit.md` for what each column means and how to trace custom-code cost) and each `*.db.log` for total query count, repeated/duplicate query shapes (candidate N+1s), and — using the call stack in each entry — the exact file:line responsible for the worst offenders.

## 3. Always restore state afterward

```bash
govard sh -c "bin/magento cache:enable full_page block_html layout"
govard sh -c "bin/magento cache:flush"
govard sh -c "bin/magento dev:profiler:disable"
govard sh -c "bin/magento dev:query-log:disable"
rm -f var/debug/db.log
```

Don't leave a target environment with caches disabled and full query logging on — this is a diagnostic state, not a normal running state, and matters especially if the target is shared with other developers or is staging rather than a disposable local box.

## Interpreting results correctly

- **A `curl` wall-clock time captured while the profiler and call-stack query logging are both active is not representative of real page load time** — the instrumentation itself (especially `--include-call-stack=true`, which walks and serializes a full PHP stack on every single query) adds real overhead, sometimes an order of magnitude. Use this setup to get query counts, repeated shapes, and file:line traces — not to report "the homepage takes N seconds." For actual load-time numbers, use the Core Web Vitals Audit (`references/core-web-vitals.md`) on the same pages with instrumentation off.
- **Query count vs. query time are different signals.** A small/fast local DB can show trivial total query *time* (tens of ms) even when the query *count* is 3–5x over budget — don't dismiss a high count just because local timing looks fine; the count is what will hurt on production's real network round-trips and larger tables.
- **Not every slow section benefits from the caches you just disabled.** `layout` cache only skips re-parsing/merging layout XML — it does NOT skip instantiating the PHP block objects for every declared block (that happens fresh on every request regardless of cache, since live objects can't be cached across requests). If a page's time is dominated by layout *generation* rather than block *rendering*, re-enabling `layout`/`block_html` cache won't fix it — the real lever is reducing how many blocks/modules contribute to that page's layout.
- **A query shape repeated with near-identical counts across all 3 page types** (not just one) is a strong signal it comes from a globally-rendered block (header/footer/cart-drawer widget), not something page-specific — prioritize fixing that over a page-specific N+1, since it's paid on every single page view site-wide.
- **A query shape whose count scales with the grid size, across your 3 category (or product-list) samples, is a separate signal from the one above — and needs at least 3 differently-sized samples to see at all.** Compare total query count and specific shape counts across the small/medium/large category samples: a shape whose count tracks the product count roughly 1:1 (e.g. ~10 on the 10-product category, ~200 on the 200-product one) is a per-item loop that isn't using the collection's already-batched data — a real N+1 that gets *worse as the catalog grows*, not a fixed per-page cost. This is exactly the kind of bug a single-category spot check cannot reveal: on a 9-product category it might add an invisible ~10 queries; on a 200-product one it's ~1,000+. Trace it with a call-stack-enabled re-capture of the largest sample (see the two-pass note in `references/database-query-profiling.md`) — common culprits are a rich-snippets/structured-data block, a review-summary widget, or a price/label renderer that calls a per-product model method (e.g. `ReviewSummary::load($id)`, a pricing `Price::getValue()` behind a custom `around` plugin) instead of pre-loading via the collection (`addSummaryData()`, `addFinalPrice()`, etc.).
- **This query count is only the initial server-rendered request** — a page that looks cheap here can still defer real work to its own client-side AJAX/GraphQL calls (see `references/ajax-load-audit.md`), which this count never sees. Don't report a low DB query count as "this page is lightweight" without also checking what it fetches after the HTML loads.
- **The same two cross-page-type signals apply to the HTML profiler, not just the query log** — a slow block/template timer repeated across all 7 pages is a global-block problem (fix once, site-wide impact); one whose `Cnt`/`Time` scales with the small/medium/large category samples is a per-item render loop that gets worse as the catalog grows. See `references/html-profiler-audit.md` for how to read the profiler table and trace either pattern to custom code.
