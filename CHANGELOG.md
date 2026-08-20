# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/).

## [1.0.5] - 2026-08-20

### Changed
- `magento2-linter` now points at Govard's native `govard audit run` (project/module_in_project/standalone target-mode resolution, native PHP-matrix policy, `--lint-provider` for optional external gates) as the authoritative Magento lint workflow, replacing a vendor CI wrapper (Sutunam's `magelint` script) as the primary gate. `magento2-code-review`, `govard-magento`, and `govard-toolbox`'s command reference now link to that authority instead of duplicating its PHP-matrix/provider policy. Depends on [ddtcorex/govard#151](https://github.com/ddtcorex/govard/pull/151) (merged, released through `v1.63.0-beta.5`).
- Documented previously-missing `--allow-lint-ssh-agent` and `--lint-jobs` flags, and corrected the PHP 8.0 support policy (real for `project`/`module_in_project`, with a toolchain-version caveat) and the `--lint-provider <name>` invocation form (no separate `--provider` flag) against the real shipped CLI.

## [1.0.4] - 2026-08-20

### Fixed
- DeepSeek Harness (DSH) submission gate: `package.json` declared `"dsh.bundle": true` as a
  flat key, which the awesome-dsh-plugin CI check does not recognize — it reads the nested
  `dsh.bundle.patch` path. Added the missing root `cordis.patch.yml` and switched the manifest
  to `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`, matching the shape the Cordis
  plugin loader (and the submission gate) actually expects. `src/index.ts`'s skill-provider
  bundle and the `.dsh-plugin/` Agent preset were already real and functional — only the
  manifest wiring was wrong.

## [1.0.3] - 2026-08-18

### Changed
- Renamed DeepSeek Harness Agent Preset from `"Agent Dev Skills (Govard & Frameworks)"` to `"Govard Dev Agent"`.

## [1.0.2] - 2026-08-18

### Changed
- Standardized marketplace publisher scope to `ddtcorex` across Claude Code (`.claude-plugin/marketplace.json`) and Codex CLI (`.agents/plugins/marketplace.json`).
- Updated plugin install command syntax to `agent-dev-skills@ddtcorex` across all documentation.
- Replaced all remaining `dev-skills-hub` references with `agent-dev-skills` in CHANGELOG.md and CLAUDE.md.

## [1.0.1] - 2026-08-18

### Changed
- Standardized marketplace publisher scope to `ddtcorex` across Claude Code (`.claude-plugin/marketplace.json`) and Codex CLI (`.agents/plugins/marketplace.json`).
- Updated plugin install command syntax to `agent-dev-skills@ddtcorex` across all documentation.

## [1.0.0] - 2026-08-18

### Added
- DeepSeek Harness (DSH) Cordis Plugin support (`@ddtcorex/agent-dev-skills`).
- DeepSeek Harness Agent Preset `"Govard Dev Agent"` (`.dsh-plugin/`).
- `--target dsh` support in `install.sh` to install both skills and DSH Agent Preset.

### Changed
- Rebranded repository to `agent-dev-skills` (`@ddtcorex/agent-dev-skills`).
- Expanded project scope to Universal AI Agent Development Skills Hub centered around Govard environment orchestration and supported web frameworks (Magento 2, Laravel, etc.).
- Updated plugin manifests across Claude Code, Codex CLI, OpenCode, GitHub Copilot, and DeepSeek Harness.

## [0.4.16] - 2026-08-15

### Changed
- `magento2-performance-audit`: tightened query-profiling guidance to the hub's lesson budget.
  It now requires request-scoped, multi-line trace parsing; comparable URL/context baselines; and
  evidence-based classification of repeated SQL as core, customization-triggered, or
  customization-amplified. Includes the Magento bundle-price attribution guardrail.

## [0.4.15] - 2026-08-14

### Added
- `magento2-performance-audit`: `references/database-query-profiling.md` documents a
  core-Magento pattern where `catalog_product_entity_tier_price`/`catalogrule_product_price`
  fire once per displayed product on category pages, traced initially (wrongly) to a
  project's own pricing plugin — the plugin is structurally identical to core's own
  `BasePrice::getValue()`. The real mechanism: `Layer\Category\CollectionFilter`'s default
  `addFinalPrice()` sets `tier_price` to a scalar/`NULL` from the price index, which fails
  `TierPrice::getStoredTierPrices()`'s `is_array()` check regardless, and
  `catalog_rule_price` isn't in that join's columns at all. Confirmed on a vanilla install
  (same scaling, 9–24/page) — the count gap was `catalog/frontend/grid_per_page` being
  ~2x, not a code difference. Includes the "diff an `around` plugin against core before
  naming it root cause" rule and the `hasData()`-based batch-load fix.
- `magento2-performance-audit`: `references/code-level-patterns.md` adds two short
  false-positive callouts to the existing N+1/collection-counting patterns (a `Form`
  vs. `Grid` DataProvider matching the N+1 grep is usually one row, not a scaling bug; a
  `count($collection->getItems())` after an earlier `foreach` on the same instance is
  free, not a live query) and a new "Batch-Preload Plugins Must Stay FPC-Safe" section —
  any `SessionManagerInterface`-backed session (customer, checkout/quote, not just
  customer group) read inside a batch-preload plugin on a listing block risks starting a
  session for anonymous FPC-cached traffic; read `Http\Context` instead, the same
  Vary-cookie signal core's own FPC-safe price code uses.

### Fixed
- The first draft of both entries above ran long (884 words prose vs. this hub's ~170–220
  word house style for a single lesson) — cut narrative restatement of the correction,
  kept the mechanism, the two verification checks, and the fix code.

## [0.4.14] - 2026-08-13

### Changed
- `magento2-performance-audit`, `magento2-dev-core`: tightened the two lessons added in
  0.4.13. Both ran 3-4x longer than this hub's own established "on one real audit" callout
  length (measured: 771 and 551 words vs. the ~170-220 word house style elsewhere in the
  same files) — cut the repeated restatements, kept the mechanism, table, grep, and fix
  code. The `magento2-dev-core` entry also named two specific third-party vendor extension
  classes (`Magento\PageBuilder\...`, `Smile\ElasticsuiteVirtualCategory\...`) as if any
  reader should expect to find exactly those two on their own project — genericized to the
  behavior pattern (a stock/category filter plugin, a search-condition filter plugin) since
  the lesson is "audit whatever plugins your project actually has," not "expect these two."
  Confirmed via `grep` across every skill's markdown that no other vendor-specific FQCN or
  project name leaked in elsewhere in the hub.

## [0.4.13] - 2026-08-13

### Added
- `magento2-performance-audit`: `references/database-query-profiling.md` documents a
  core-Magento pattern where `catalog_product_super_link` lookups
  (`Configurable::getParentIdsByChild()`) repeat 48–316×/page on a catalog with zero
  configurable products. Tracing call stacks (not just the query shape) showed the waste
  actually comes from **two unrelated core plugins converging on the same resource-model
  method** — `Magento\Weee\Plugin\Model\ConfigurableVariationAttributePriority` (89% of
  calls, gated by `tax/weee/enable`, unrelated to configurable products at all) and
  `Magento\ConfigurableProduct\Model\Plugin\ProductIdentitiesExtender` (11%, always
  active). Confirmed empirically that toggling `tax/weee/enable` on vanilla Luma sample
  data reproduces the same waste (0 → 1 wasted call/product), proving it's core behavior,
  not project-specific. Documents the frame-#4 grep to get the full caller distribution
  before attributing a fix to just the first plugin traced, and the project-level
  `aroundGetParentIdsByChild()` fix (request-memoized "has configurable products" check,
  patched at the resource-model boundary so it covers every current and future caller).
- `magento2-dev-core`: `references/architecture-patterns.md` documents a plugin-ordering
  hazard under Plugins (Interceptors) — a batch-prefetch plugin that forces early
  collection load (`afterCreateCollection` calling `getItems()`) shipped safely on a
  project-owned leaf class (grep confirmed no other plugin on it), but registering the
  same kind of plugin on the shared core `Magento\CatalogWidget\Block\Product\ProductsList`
  to cover other widgets too meant two real vendor plugins already there
  (`Magento\PageBuilder\...\ProductsListPlugin` sortOrder=1, `Smile\ElasticsuiteVirtualCategory\...\ProductsListPlugin`
  sortOrder=100) would have had their stock/category/virtual-category filters silently
  dropped sitewide without an explicit higher `sortOrder`. Documents the grep to run
  before registering any side-effecting plugin on a class not owned by the project, and
  the rule of thumb for setting `sortOrder` once other plugins are found.

## [0.4.12] - 2026-08-13

### Added
- `magento2-performance-audit`: `references/report-template.md` now requires a
  **Per-Page Query Detail** section — the complete, unfiltered normalized-query
  breakdown for every captured page — as a standing part of every
  database-profiling report, not just the >5-threshold Repeated Query Shapes
  table. Cross-referenced from `SKILL.md`'s Workflow step 9 and from
  `database-query-profiling.md` so it isn't only produced when a user happens
  to ask for it.
- `magento2-performance-audit`: a fifth capture-integrity habit in
  `database-query-profiling.md` — a single homepage warmup does not warm every
  sample page. A real audit saw the same category page read 321, then 676,
  then 320, then 236 queries across separate passes (cron/daemons ruled out);
  isolating the page showed each distinct URL pays its own first-visit cold
  cost after `cache:flush` (layered-nav attribute metadata, category-specific
  EAV lookups) independent of what else was visited first — visiting the
  homepage first never pays it on a category/product page's behalf.
  `per-page-type-audit.md`'s capture loop now warms each URL individually
  right before its own real capture, and re-runs the full 7-page pass a second
  time to confirm exact reproducibility.
- `magento2-performance-audit`: fixed the `base_url` verification habit in
  `database-query-profiling.md` — checking `core_config_data` directly can
  report a value the application isn't actually using, since Magento resolves
  config through a precedence chain (env vars → `app/etc/env.php` locked
  config → DB → `config.xml` defaults) and a locked/overridden `base_url`
  silently wins over the DB row. Use `bin/magento config:show
  web/unsecure/base_url` instead, which resolves the same chain a real
  request does.
- `magento2-performance-audit`: `per-page-type-audit.md`'s page-selection
  queries (section 0) now open with a table-prefix check before any SQL —
  every bare table name in that file (`catalog_category_product`,
  `catalog_category_entity`, `url_rewrite`, etc.) assumed no `db.table_prefix`
  configured in `app/etc/env.php`, which fails loudly on a prefixed install.
  Doesn't apply to `database-query-profiling.md`'s MySQL system-variable
  checks or to `EXPLAIN`ing already-captured SQL, since that SQL already has
  the real prefix baked in. Swept the rest of the plugin for the same gap and
  fixed the two other spots found: `infrastructure-checks.md`'s
  `cron_schedule` freshness check, and a `core_config_data` example in
  `govard-magento/SKILL.md` that had hardcoded an `m2_` prefix as if it were
  universal (it isn't — it depends on that specific install). Also annotated
  `govard-toolbox/SKILL.md`'s generic query example, which is framework-agnostic
  and can carry a Magento/WordPress/etc. prefix depending on the project.

## [0.4.11] - 2026-08-13

### Added
- `magento2-performance-audit`: a fourth capture-integrity habit in
  `database-query-profiling.md`, alongside the existing HTTP-status/UA/base_url
  warnings — don't trust a query-count reading that looks like an outlier,
  especially the first page captured right after `cache:flush`/the warmup
  request. A real audit saw the homepage read 875 queries on the first pass
  (four shapes — `store.*`/`store_group.*`/`store_website.*`/`SET NAMES` —
  each repeating ~210 times), which never reproduced across 4 independent
  re-captures; the likely cause was the *previous* request's shutdown-time log
  write landing after the log was truncated for the next capture. The
  project-baseline paragraph in the same file now points back at this check
  before a number is recorded as a baseline.
- `magento2-performance-audit`: `per-page-type-audit.md` step 0 now checks
  category `is_active` alongside the existing product redirect/website-assignment
  checks — a disabled category still has real `catalog_category_product` rows
  and a resolvable `url_rewrite`, so it looks like a valid small/medium/large
  sample right up until the request 404s.
- `magento2-performance-audit`: `SKILL.md` now distinguishes a scoped ask (the
  user's own words name one specific audit category, e.g. "just check the
  MySQL query count") from an unscoped one ("audit performance", "review this
  project") — the former runs only that category and states the reduced scope
  explicitly in the report; the latter still requires all 9 Workflow steps,
  unchanged. Added as a row in the shortcut-rationalization table to keep
  legitimate scoping distinct from silently dropping steps.

## [0.4.10] - 2026-08-13

### Added
- `magento2-linter`: the same "try `composer install` before concluding
  coverage is blocked" habit added for phpcs's `installed_paths` in 0.4.9
  now also documented for PHPStan — a diff that adds a new `composer.json`
  require reports every method on the unresolved class as undefined,
  identical in appearance whether the package genuinely needs live
  private-repo credentials or is already sitting in `composer.lock`/the
  local Composer cache from a prior install elsewhere in the same
  environment. Run `composer install` first; only report PHPStan coverage
  as blocked if it actually fails or prompts for credentials you don't
  have.
- `magento2-linter`: a new callout under "PHPStan Output" on
  `Call to an undefined method Vendor\Class::setFoo()/getFoo()` as a
  distinct, common false-positive class — almost every Magento Block/Model
  extends `DataObject`'s magic `get*`/`set*`/`has*`/`unset*` accessors,
  which PHPStan can't see without `bitexpert/phpstan-magento`. Documents
  the actual technique for telling a real bug from this noise: look for a
  working precedent of the exact same method on the exact same class (or a
  clearly-related sibling) elsewhere in the codebase. Includes a real
  worked example from a live review — one such finding was the legitimate
  magic-accessor pattern (confirmed via a working vendor precedent), a
  second, superficially identical-looking finding on an unrelated method
  name was a real, previously-undetected bug (no precedent existed on that
  class's actual ancestor chain — it silently returned empty instead of
  throwing).

## [0.4.9] - 2026-08-13

### Fixed
- `magento2-linter`: retracted the previous release's `magelint --path=`
  guidance for in-project `app/code/Vendor/Module` targets — it shipped
  without actually being run, and is wrong. Verified by reading the real
  `magelint` script: `--path` still requires `composer.json` to exist
  *directly at* that path (no "mount the project root, scope the lint
  target to a subdirectory" mode exists), and once resolved, the whole
  `PROJECT_PATH` gets rsync'd and linted as one unit — there's no
  further subdirectory scoping inside the tool. "In-Project `app/code/`
  Modules" in `magento2-linter/SKILL.md` now documents the actual options
  (bare `phpcs`/`phpstan` scoped to the module using the project's own
  installed tools; a full-project unscoped `magelint` run; or a hand-built
  synthetic `composer.json` for real per-module isolation) instead.

## [0.4.8] - 2026-08-13

### Added
- `magento2-dev-core`: a new "XML Config Merging: Per-File vs. Merged
  Schema" section in `references/architecture-patterns.md` — many Magento
  config readers validate a single file against a lenient per-file schema
  (e.g. Magento_Widget's `widget_file.xsd`, where `class` is optional) and
  only the fully merged config against the stricter merged schema (`class`
  required in `widget.xsd`). Documents how to tell which schema actually
  applies before flagging a missing "required" attribute as a break.
- `magento2-dev-core`/`magento2-code-review`: new `M2-ARCH-008` code
  (two or more modules declaring `<preference>` for the same class/
  interface — silently resolved by merge order, no `sortOrder` arbitration
  the way plugins have). `plugin-observer-conflict-check.md` (now titled
  Plugin/Observer/**Preference** Conflict Check) gained a "Find other
  preferences for the same class/interface" grep step alongside its
  existing plugin/observer checks.
- `magento2-code-review`: `theme-audit-checks.md` section 1 now also
  detects CSP vs. non-CSP Hyvä (`Hyva/default-csp` vs. plain
  `Hyva/default`/`Hyva/reset`) and whether the CSP view-model mechanism is
  actually wired up (real class in `vendor/hyva-themes/*`, `hyvaCsp`
  assigned via a layout `viewModel` argument somewhere) — not just
  Hyvä-vs-Luma. A missing `registerInlineScript()` call on a theme with no
  working CSP mechanism is now a non-finding instead of `M2-SEC-010`;
  `scope-modes.md`'s PR/MR-scope static check references the same gate.
- `magento2-linter`: guidance for in-project `app/code/Vendor/Module`
  targets (as opposed to standalone Composer packages) — mount/run a CI
  wrapper like `magelint` from the project root and scope the actual lint
  target with its own path flag (e.g. `--path=app/code/Vendor/Module`)
  instead of trying to isolate the module directory alone, which fails
  immediately with no `composer.json` to install against.
- `magento2-linter`: a troubleshooting note for `phpcs --standard=Magento2`
  failing with "Referenced sniff ... does not exist" — check
  `composer.lock` before concluding the dependency is missing; if it's
  already resolved there, a plain `composer install` (safe/idempotent,
  `Nothing to install, update or remove` is the expected outcome) often
  fixes it by re-running the package's `installed_paths` registration
  script.

## [0.4.7] - 2026-08-13

### Added
- `govard-magento`: `govard tool magerun config:store:get` (cross-scope config
  lookup) added to the Configuration section, and a new **Diagnostics**
  section (`sys:check`, `sys:info`) — both additions alongside the
  existing `bin/magento` commands, nothing replaced.
- `magento2-hyva-dev`: the manual "test in browser, check console for CSP
  errors" Verification step is now a **CSP Console Check** subsection —
  Chrome DevTools MCP's `list_console_messages` preferred when connected,
  the manual browser check kept as a complete, documented fallback.
- `magento2-code-review`: GitHub MCP (`pull_request_read`,
  `pull_request_review_write`, `add_comment_to_pending_review`) added as
  the preferred remote-fetch mechanism for GitHub PRs — including posting
  findings back as inline PR comments instead of only printing a report.
  `gh pr diff`/`glab mr diff` remain the complete fallback for GitHub
  without MCP and for GitLab targets.
- `README.md`: a prominent note (right after the intro paragraph) that
  this skillset works best paired with
  [Govard](https://github.com/ddtcorex/govard), with its one-line install
  command, plus a list of the other soft dependencies individual skills
  assume (n98-magerun2, PHPCS/PHPStan/PHPMD and magento/security-package
  Composer packages, Node/npm, Playwright, Chrome DevTools MCP, GitHub MCP).
- `magento2-dev-core`/`magento2-linter`: a new `M2-STYLE-xxx` code band in
  `severity-and-codes.md` for PHPMD's own finding categories (complexity,
  length, parameter count, unused code, naming) — previously PHPMD findings
  had no code to map to, forcing `magento2-code-review` reports to leave
  them unmapped.
- `magento2-code-review`: PR/MR scope no longer skips performance/theme
  checks entirely — a new "Performance/theme checks by scope" section in
  `references/scope-modes.md` always runs the static, file-scoped subset
  (code-level performance-pattern greps, Customer Data rule reads, CSP
  nonce/pattern check, Alpine hydration-root count) at PR/MR scope, and
  requires the Coverage note to name which live/infra checks (per-page
  audit, Core Web Vitals trace, Tailwind/RequireJS bundle-size regression,
  etc.) were skipped and why. Project/module/theme scope keep the full
  live/infra checks as before.

### Fixed
- `magento2-linter`: "Interpreting Results" now warns that real PHPCS/
  PHPStan/PHPMD output on PHP 8.4+ commonly includes PHP-8.4-compatibility
  deprecation noise the clean example output doesn't show, and instructs
  checking the actual exit code (`echo "EXITCODE:$?"`) instead of judging
  success/failure by output shape alone.
- `magento2-security-scan`: added a "scope boundary" note — Authentication
  & Authorization, Data Exposure, and CSP Configuration are environment-
  level checks (not file-scoped), run once per audit at project/module/
  theme scope and skipped entirely at PR/MR scope; previously undocumented,
  leaving this to be decided ad hoc per review.
- `magento2-dev-core`: `M2-ARCH-004` ("Raw SQL outside a ResourceModel") now
  explicitly excludes a deliberate, isolated batch-read query used to fix
  an N+1 pattern (the same thing `M2-PERF-001` asks for) — previously the
  taxonomy had no way to distinguish that from careless raw SQL.

## [0.4.6] - 2026-08-12

### Added
- New skill `magento2-code-review`: orchestrates a PR/MR, module, theme, or
  full-project review across the existing QA trio (`magento2-linter`,
  `magento2-security-scan`, `magento2-performance-audit`) and
  `magento2-dev-core`, at one of four scopes (full path, explicit file list,
  local `git diff`, or remote `glab mr diff`/`gh pr diff` fetch — the last
  one explicitly limited to text-pattern checks, since PHPStan/PHPMD need a
  real checkout). Adds a plugin/observer conflict check
  (`references/plugin-observer-conflict-check.md`) and theme-scope routing
  for Hyvä and Luma (`references/theme-audit-checks.md`), including three
  checks that existed nowhere before: Tailwind bundle-size regression,
  Alpine hydration-root count, and RequireJS/LESS output-size regression.
- `magento2-dev-core`: new shared `references/severity-and-codes.md` — a
  Critical/High/Medium/Low severity scale and stable `M2-<PREFIX>-xxx`
  finding-code catalogue used by the whole QA quartet (`magento2-linter`,
  `magento2-security-scan`, `magento2-performance-audit`,
  `magento2-code-review`). Replaces the skill's previous inline
  "Anti-Pattern Severity" table.
- `magento2-linter`: new PHPMD capability (cyclomatic complexity, unused
  code, code smells — a signal neither PHPCS nor PHPStan catches) and a
  "Scoping" section accepting an explicit file list instead of only a
  directory path.
- `magento2-security-scan`: new "Scoping" section accepting an explicit file
  list instead of only a directory path.

### Fixed
- `magento2-linter`'s new Security Pattern Detection code column cites the
  same shared `M2-ARCH-001` code as `magento2-dev-core`'s anti-pattern
  table for `ObjectManager::getInstance` (Critical) — an early draft of
  the shared taxonomy briefly minted a second code for this pattern before
  this branch shipped; corrected before release.

## [0.4.5] - 2026-08-12

### Added
- `govard-magento`: new **Frontend Development (BrowserSync / LiveReload)** section covering
  `govard frontend start/logs/stop`, the `stack.features.frontend_sync` prerequisite, Hyva vs.
  Luma discovery requirements (mutually exclusive, exactly one `scripts.browser-sync` owner for
  Hyva), the `browser-sync.config.js` settings that must be correct (`changeOrigin: false`,
  `cookies.stripDomain: false`) to avoid breaking Magento's base-URL redirect or session cookies,
  and how to switch the active Hyva theme. Also adds matching trigger phrases ("start frontend
  sync", "run browser-sync", "govard frontend") to the skill description, which previously had no
  way to match this workflow at all.

## [0.4.4] - 2026-08-06

### Added
- `magento2-linter`: new **Real CI Verification Is Mandatory Before Pushing** section — running a
  project's real CI lint wrapper (e.g. Sutunam's `magelint`) is now a required step before
  pushing or opening a PR/MR, not an optional nice-to-have. A local approximation is a fast
  pre-check only; it must never be presented as proof the branch is clean.
- `magento2-linter`: new callout — when a standalone package uses a `src/`-rooted PSR-4 layout,
  `Test/` must live inside `src/` (e.g. `src/Test/...`), not as a sibling directory at the package
  root, or it silently fails to autoload and gets skipped entirely by a `paths: [src]`-scoped
  phpstan config.

### Fixed
- `magento2-linter`: new callout — new findings sharing an error message with an already-tolerated
  pattern still need their own check against real CI, not a blanket dismissal by shape. On one real
  fix, a batch of new findings got bucketed with older, accepted ones as "same pattern"; the real
  CI run disagreed on one of them.

## [0.4.3] - 2026-08-05

### Fixed
- `magento2-linter`: the "Standalone Composer Packages Need Isolated Verification" section added
  in v0.4.2 was itself followed incorrectly the very next time it was used: phpstan was invoked
  against an isolated scratch copy without first `cd`-ing into it, so it silently loaded the
  *host* project's `vendor/autoload.php` (which had `phpunit/phpunit` installed) instead of the
  scratch copy's. The isolated check reported 0 errors; the real CI, run directly, reported 121 —
  every PHPUnit-based test class had cascaded into "undefined method" findings once the actually
  isolated autoloader was in play. Added an explicit callout that isolating `vendor/` isn't
  enough — the working directory has to be isolated too, since PHPStan resolves
  `vendor/autoload.php` relative to cwd, not to `-c`'s location.

### Added
- `magento2-linter`: documents a related, common case this incident surfaced — a standalone
  package's `Test/` directory can be legitimately unanalysable under a real `--no-dev` CI install
  when the package never declares `phpunit/phpunit` (common, since Composer doesn't force this).
  Recommends excluding `Test/` from that package's own `phpstan.neon` with an explanatory
  comment, rather than adding `phpunit/phpunit` to a real `require` just to satisfy CI (which
  would bloat every production install of the package).

## [0.4.2] - 2026-08-05

### Added
- `magento2-linter`: new **Check the Project's Real CI Setup First** section — a real audit
  removed `@phpstan-ignore` comments as "stale" based on a bare local `vendor/bin/phpstan` run,
  not realizing the project's actual CI installed `bitexpert/phpstan-magento` (a Magento-aware
  extension already listed in this skill's own Prerequisites), which resolves the exact patterns
  those comments were suppressing. Documents searching for the project's real CI config/wrapper
  script and matching its installed PHPStan extensions before trusting a bare local run or
  touching an ignore list.
- `magento2-linter`: new **Standalone Composer Packages Need Isolated Verification** section —
  linting a standalone Composer package (its own `composer.json`, developed as its own git repo)
  nested inside a large host project's `vendor/` can both hide and fabricate findings, because the
  host project's `generated/code/` and autoloader don't match what the package's own isolated CI
  install would see. Documents copying the package to a scratch directory and running
  `composer install --no-dev` there before linting, matching how per-package CI actually verifies it.

## [0.4.1] - 2026-07-31

### Added
- `magento2-performance-audit`: new mandatory **Repeated Query Shapes** table in the Audit
  Report Template — every normalized query shape repeating more than ~5 times on a single page
  load must be listed with its trace and an assessment, not just collapsed into a pass/fail
  "no N+1 detected" checkbox. Closes a gap where a borderline-repeated query could be silently
  judged "probably not a bug" and left out of the report entirely, with no evidence for the
  reader to check that judgment against.
- `magento2-performance-audit`: new `references/html-profiler-audit.md` — the HTML profiler
  (block/template PHP timing) was previously bundled into the database-query-profiling
  reference despite measuring a different signal (PHP execution time, not SQL) with no real
  interpretation guidance. The new file explains what each profiler column means, how to trace
  a slow timer to custom code (including a custom plugin wrapping a *core* method, which hides
  the extra cost inside a core timer), and applies the same site-wide/size-scaling diagnostic
  signals already used for repeated queries to slow blocks/templates. Adds a matching mandatory
  **Slowest Blocks/Templates** table to the Audit Report Template.

### Changed
- `magento2-performance-audit`: Workflow steps 3 and 9, the Audit Categories table, and the
  "Common ways this gets shortcut" table updated to reflect the HTML profiler's own reference
  file and the two new report tables.

## [0.4.0] - 2026-07-31

### Added
- Codex CLI plugin support: `.codex-plugin/plugin.json` (points `skills: "./skills/"` at the
  same `skills/` directory Claude Code's plugin already uses — no content duplication) plus a
  self-listing `.agents/plugins/marketplace.json`, mirroring the existing
  `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` pair. This repo is now
  installable as a plugin on both Claude Code and Codex CLI from the same source. Verified
  end-to-end against the real `codex` CLI (`codex plugin marketplace add .` /
  `codex plugin add agent-dev-skills@ddtcorex`) — all 10 skills resolve correctly.
- `.github/workflows/release.yml` now also validates `.codex-plugin/plugin.json` and
  `.agents/plugins/marketplace.json` (`jq empty`) on every tagged release.
- README: new "Codex CLI — as a plugin" install section, and a directory-structure entry for
  the new Codex manifests.

### Changed
- `magento2-performance-audit`: split from a single 9,349-word SKILL.md into a lean ~1,165-word
  SKILL.md plus 8 `references/*.md` files (one per audit category), following current
  progressive-disclosure skill-authoring guidance. Cuts the skill's on-invoke token cost from
  ~24.3k to ~3k (verified via `claude --plugin-dir . plugin details agent-dev-skills`) — previously
  ~4x every other skill in this repo, now in line with the rest. No content was cut, only moved;
  the mandatory-checklist framing, workflow steps, and self-verification gate stay in SKILL.md
  exactly as before.
- All 10 skills' frontmatter `description` fields rewritten from a bullet-list `Use when: - "X"`
  format to the current third-person convention (`This skill should be used when the user asks
  to "X", "Y"...`) — same trigger phrases and dependency notes, reworded to match current
  skill-authoring guidance.
- `CLAUDE.md`: documents the dual-ecosystem (Claude Code + Codex CLI) plugin architecture —
  updated marketplace/self-listing section, discovery-paths table, Commands, and release
  checklist (version now bumps in three files, not two).

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
  `/plugin marketplace add ddtcorex/agent-dev-skills` + `/plugin install agent-dev-skills@ddtcorex`.
- `install.sh`, a one-line installer/updater (`curl -fsSL .../install.sh | bash`):
  clones into `~/.agent-dev-skills` and links each skill into whichever directory
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
  `agent-dev-skills`, and repositioned the description around "development
  skills" generally rather than only the Magento 2 / Govard skills bundled
  today.
