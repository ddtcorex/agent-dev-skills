# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/).

## [0.3.1] - 2026-07-29

### Added
- `magento2-performance-audit`: added a mandatory-checklist framing right after the intro and a
  "Common ways this gets shortcut" rationalization table, plus a hard self-verification gate as
  the final workflow step (step 10) — every checkbox in the Audit Report Template must resolve to
  either checked-with-evidence or an explicit `Skipped: <reason>` before the report can be
  presented as done. Closes a gap where an agent could run only the steps that felt highest-signal
  for the effort and quietly drop the rest while still presenting a confident, complete-looking
  report. Found via dogfooding: a real audit run skipped 3 of the 9 workflow steps (Slow Query
  Analysis, Cache Invalidation Efficiency, Client-Side AJAX Load) entirely and initially
  under-sampled the Per-Page-Type Audit (1 URL instead of 3 per type) — all without flagging
  either omission — even though the skill's own text already said "3 URLs, not 1" in plain
  language. The gap wasn't instruction clarity, it was the absence of a check *before* the report
  was called finished.

## [0.3.0] - 2026-07-29

### Added
- `magento2-performance-audit`: new **Slow Query Analysis** section — reuses the existing query
  log's `TIME:` field to catch app-level slow queries, adds MySQL/MariaDB's own `slow_query_log`
  (with `mysqldumpslow`/`pt-query-digest` analysis) for cron/import-triggered queries the app-level
  log can't see, and an `EXPLAIN`-based workflow to confirm missing-index findings instead of
  reporting on grep pattern-match alone.
- `magento2-performance-audit`: Per-Page-Type Audit now samples 3 URLs per page type (small/medium/
  large category, 3 products) instead of 1, plus a new size-scaling diagnostic — comparing query
  count across differently-sized samples of the same type catches per-item N+1s whose cost only
  becomes visible at scale, which a single-category spot check can't see at all. Caught two real
  N+1s in dogfooding (a rich-snippets block and a pricing plugin both loading per-product data
  individually) that a 1-URL-per-type audit had missed entirely.
- `magento2-performance-audit`: base-URL verification callout — a project's `base_url` can be stale
  (synced from staging/production) and point at a different server than the one actually being
  audited, producing a silently-empty or wrong-target capture that still looks like valid data.
- `magento2-performance-audit`: two-pass call-stack strategy for the DB query log — count/shape
  first without `--include-call-stack`, re-capture with it only for the page(s) that need tracing,
  instead of stack-walking every page from the start.
- `magento2-performance-audit`: Core Web Vitals section now explains how to read an LCP breakdown
  where render delay dominates (common on Alpine.js/Hyvä and other JS-hydration-driven themes) —
  points at JS-gated visibility (`x-cloak`, reactive `opacity-0` classes) rather than network/image
  causes.
- `magento2-performance-audit`: Cache Invalidation Efficiency Audit now documents a fallback for
  when admin credentials aren't available to reproduce an entity save — report as unverified rather
  than skip silently or work around it with a risky direct DB/bootstrap-script action.
- `magento2-performance-audit`: Client-Side AJAX audit now checks which reactive/AJAX mechanism a
  project actually uses before applying the sections.xml checklist — some stacks (Magewire,
  PWA/headless, GraphQL-driven state) replace it, making the standard reload-storm check moot.

### Changed
- `magento2-performance-audit`: cron and queue-consumer findings are no longer automatically scored
  as Medium/High severity on local dev — an idle crontab and idle payment consumers are frequently
  the deliberate, safe default there (avoids real emails/gateway calls against synced production
  data), the same "confirm the environment first" rule already applied to Redis/Varnish. Severity
  now escalates only once the target is confirmed staging/production.
- `magento2-performance-audit`: Workflow steps renumbered/expanded (now 9 steps) to include slow
  query analysis and the reactive-architecture check.

## [0.2.3] - 2026-07-24

### Fixed
- `magento2-performance-audit`: the PDF export example used `--print-to-pdf-no-header`, a flag
  that doesn't exist in current Chrome and is silently ignored — the real one is
  `--no-pdf-header-footer`. Caught by regenerating the report PDF and finding Chrome's injected
  timestamp/title/URL/page-number header and footer still present; corrected the command and
  added a verification step (`pdftotext` the first page, check for a stray date/URL line) so a
  wrong/renamed flag doesn't silently pass again.

## [0.2.2] - 2026-07-24

### Added
- `magento2-performance-audit`: noted that a published report (markdown or rendered artifact) can
  be exported to PDF via the browser's Print dialog or, from the CLI, headless Chrome
  (`--print-to-pdf`) since the rendered page is self-contained — with a caveat that the PDF is a
  rendering convenience, not a substitute for keeping the markdown/HTML source.

## [0.2.1] - 2026-07-24

### Fixed
- `magento2-performance-audit`: every `curl`-based capture example now requires a realistic
  browser `Accept`/`User-Agent` and an HTTP-status check before the response is trusted. A live
  audit this session found a bare `Accept: text/html` with no `User-Agent` silently triggering a
  fatal 500 on every page type of a real project — the response still looked like a page (HTML,
  a query log, a profiler table) and was analyzed as one, producing query counts wrong by 20-70x
  with no indication anything had failed.
- `magento2-performance-audit`: the DB query-count grep pattern (`grep -c '^## QUERY'`) was
  anchored against a header format (`## <connectionId> ## QUERY`) that never matches at line
  start, silently producing a false "0 queries" reading.
- `magento2-performance-audit`: `bin/magento config:set dev/debug/debug_logging 1` targeted the
  wrong config store for enabling cache-invalidation debug logging; corrected to the deployment
  config command (`setup:config:set --enable-debug-logging=1`), and noted it's on by default
  outside production mode.

### Changed
- `magento2-performance-audit`: replaced the flat `< 80` / `< 150` / `< 150` query-count
  pass/fail gate with a tiered read (vanilla / typical-extensions / heavy-stack / likely-N+1)
  plus project-specific baseline tracking for repeat audits — the flat numbers don't survive
  contact with a real commerce Magento build carrying a typical third-party extension stack.
- `magento2-performance-audit`: Core Web Vitals now prefers Chrome DevTools MCP's
  `performance_start_trace` when available, with Lighthouse CI as the CI/no-MCP fallback.
- `magento2-performance-audit`: noted the report can be published as a rendered artifact where
  the environment supports it (e.g. Claude Code), with markdown staying the portable fallback.

### Added
- `magento2-performance-audit`: grep recipes for scanning `app/code` for N+1/collection-count
  anti-patterns, vendor-vs-in-house guidance for third-party N+1s, business-critical severity
  escalation for idle payment/inventory message-queue consumers, and a note that DB query counts
  only cover the initial server-rendered request (not the page's own AJAX/GraphQL follow-ups).

## [0.2.0] - 2026-07-24

### Added
- `magento2-performance-audit`: **Cache Invalidation Efficiency Audit** section —
  traces `full_page` cache flushes via Magento's built-in `cache_invalidate:`
  debug.log entries (Redis or file backend, no env.php changes needed) or, for
  Varnish, `varnishlog`/`ban.list`, to distinguish correctly-scoped invalidation
  from custom code causing blanket flushes; includes a temporary diagnostic
  plugin pattern for tracing cron/CLI-triggered flushes back to file:line, and
  a WRONG/CORRECT code pattern for targeted vs. blanket cache clearing.
- `magento2-performance-audit`: **Client-Side AJAX Request Load Audit** section —
  captures the same-origin AJAX footprint of a page (customer data, GraphQL,
  custom endpoints) across all 3 page types, since these bypass `full_page`
  cache entirely and are what JS-executing crawlers multiply under load; covers
  auditing `sections.xml` for overly broad Customer Data invalidation and a
  known Magento quirk where an empty `sections=` parameter returns every
  registered section (including the full country/region directory) instead of
  none.

Both new sections were validated live against a running Magento 2.4.7 project
rather than written from assumption alone — this caught and corrected an
invalid config path, an unnecessary env.php step, and a wrong assumption about
what a "full flush" looks like in `debug.log`.

## [0.1.1] - 2026-07-24

### Added
- `CLAUDE.md` documenting the repo's architecture, plugin/marketplace structure,
  `install.sh` design, and release checklist for future contributors.
- `.gitignore` for common local/editor artifacts.

### Changed
- Strengthened cross-skill dependency signaling: all 8 skills declaring
  `depends:` (`govard-laravel`, `govard-magento`, `magento2-backend-dev`,
  `magento2-frontend-dev`, `magento2-hyva-dev`, `magento2-linter`,
  `magento2-performance-audit`, `magento2-security-scan`) now state their
  prerequisite as an explicit `REQUIRED BACKGROUND` instruction in the skill
  body, since Claude Code's schema doesn't act on `depends:` frontmatter alone.
- Removed `Usage`/"Trigger phrases" sections that duplicated each skill's
  frontmatter `description` verbatim; kept the one genuine step-by-step
  workflow (renamed to `Workflow`) in `magento2-performance-audit`.

## [0.1.0] - 2026-07-14

### Added
- Packaged the skill collection as a Claude Code plugin (`.claude-plugin/plugin.json`,
  self-listing `marketplace.json` with `"source": "./"`), installable with
  `/plugin marketplace add ddtcorex/dev-skills-hub` + `/plugin install dev-skills-hub@dev-skills-hub`.
- `install.sh`, a one-line installer/updater (`curl -fsSL .../install.sh | bash`):
  clones into `~/.dev-skills-hub` and links each skill into whichever directory
  Claude Code, OpenCode, Codex CLI, or GitHub Copilot scans, with project/personal
  scope, symlink/copy modes, selective skill/target install, and `--uninstall`.
- 10 skills: `magento2-dev-core`, `magento2-linter`, `magento2-performance-audit`,
  `magento2-security-scan`, `magento2-hyva-dev`, `magento2-frontend-dev`,
  `magento2-backend-dev`, `govard-toolbox`, `govard-magento`, `govard-laravel`.

### Changed
- Restructured from a flat top-level layout to `skills/<name>/SKILL.md` — the
  layout Claude Code's plugin loader requires and the one the wider
  [Agent Skills standard](https://agentskills.io) (also adopted by OpenCode,
  Codex CLI, and GitHub Copilot) expects.
- Renamed the project — repo, plugin, and marketplace — from `ai-skills` to
  `dev-skills-hub`, and repositioned the description around "development
  skills" generally rather than only the Magento 2 / Govard skills bundled
  today.
