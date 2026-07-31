# Infrastructure, Cache, Indexer, Async, Asset, Cron & Security Checks

Full detail for Workflow steps 1-2 (infrastructure, indexer/cron) and the quick security probes referenced at the end of the checklist.

## 1. Infrastructure Configuration

| Check | Expected | Command |
|-------|----------|---------|
| Application Mode | `production` | `bin/magento deploy:mode:show` |
| PHP OPcache | >= 256MB | Check php.ini |
| Redis (Session) | Enabled | Check `app/etc/env.php` |
| Redis (Cache) | Enabled | Check `app/etc/env.php` |
| Varnish | Running + terminating HTTPS/HTTP in front of the app | Check for a running Varnish container/process and its VCL config; the exact config file is project-specific (e.g. `nginx.conf`, a Docker/orchestrator config file, or a cloud provider's Varnish config) — there is no universal filename to grep for. |

> On a **local dev environment** it's normal and expected to have no Redis/Varnish at all (file-based session/cache, FPC often disabled) — don't flag this as a bug unless the target is staging/production. Confirm which environment you're actually auditing before treating any of the above as a problem.

## 2. Cache Configuration

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

> If `full_page` cache is flushing far more often than page saves/deploys would explain, see **Cache Invalidation Efficiency Audit** (`references/cache-invalidation-audit.md`) — Magento's own entity-save invalidation is narrowly scoped by design; unexplained broad/frequent flushes are almost always custom observer or plugin code.

## 3. Indexer Configuration

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

## 4. Async Operations (message queue consumers)

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

## 5. Asset Optimization

```bash
# JS Bundling (recommended for production)
govard sh -c "bin/magento config:set dev/js/enable_js_bundling 1"
govard sh -c "bin/magento config:set dev/js/minify_files 1"

# CSS Minification
govard sh -c "bin/magento config:set dev/css/minify_files 1"
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
