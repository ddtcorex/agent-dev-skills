# Cache Invalidation Efficiency Audit

Full detail for Workflow step 5.

Magento's default invalidation on entity save (product, category, CMS block/page, etc.) is already narrowly scoped — `getIdentities()` on the saved entity returns a small set of cache tags, and only pages/blocks carrying those tags get cleared. The problem this section targets is **custom code** (an observer, a plugin, a cron job, a "just flush everything to be safe" habit) that widens or duplicates that invalidation — clearing the entire `full_page` cache (or all cache types) on saves that only ever needed to touch a handful of tags. This is invisible in `cache:status` (caches are still "Enabled") and easy to miss without tracing what actually gets cleared and why.

## A. Built-in FPC (Redis or file cache backend, no Varnish)

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

## B. Varnish-fronted FPC

Varnish invalidation happens via HTTP BAN requests carrying an `X-Magento-Tags-Pattern` header — Magento's `debug.log` doesn't see this directly, so trace it on the Varnish side:

```bash
# Watch BAN requests live as you reproduce an action
varnishlog -g request -q 'ReqMethod eq "BAN"'

# Inspect currently active bans — a fast-growing list, or any pattern that is
# just ".*" (matches everything), is the same "flush-all" anti-pattern as mode=all above
varnishadm ban.list
```

A `.*` pattern (or a pattern far broader than the tags of the entity actually saved) means the whole cache was purged for one change. To trace which PHP code issued that specific BAN, use the same temporary diagnostic plugin from branch A — Varnish purges still originate from the same `CacheInterface`/`clean_cache_by_tags` call path in Magento before the BAN request goes out.

## Interpreting results

| Signal | Pattern | Severity |
|--------|---------|----------|
| Full/blanket flush | debug.log entry whose tags are **only** the bare type tag (e.g. `["FPC"]` alone, no entity tag alongside it), or `X-Magento-Tags-Pattern: .*` in varnishlog/ban.list | High |
| Over-broad tag scope | Tag list clears far more than the entity actually changed (e.g. clearing every `cat_p_*` tag for a single product save) | Medium-High |
| Flush tied to non-rendering fields | Invalidation fires on saving a field never used in any cacheable block's `getIdentities()`/cache tags | Medium |
| Untraceable / scheduled flush | Repeated clean/BAN entries with no corresponding admin/API save nearby — often a cron job or deploy script calling `cache:flush` on a timer "just in case" | High |
| Duplicate flush per save | The same tag set logged more than once within seconds of one single save — rule out an async reindex re-invalidating the same tag shortly after (expected) before calling it a redundant custom observer (a bug) | Low-Medium |

> Flush frequency should scale with save/import volume, not run on a fixed schedule unrelated to actual content changes. If `cache:flush`/`cache:clean` shows up in a cron job or deploy script "just to be safe," that's a scheduled full flush independent of whether anything relevant even changed — treat it the same as a bare-type-tag finding above.
