---
name: magento2-performance-audit
description: |
  This skill should be used when the user asks to "audit performance", "check Core Web
  Vitals", "run Lighthouse", "check server configuration", "verify Redis/Varnish setup",
  "analyze database queries", "find N+1 query issues", "review indexer configuration", "check
  cron health", "debug cache flush", asks "why does full_page cache keep flushing", wants to
  "trace FPC invalidation", or reports "too many ajax requests", a "customer data section
  reload storm", or a "crawler overloading server". Performs a comprehensive performance and
  health audit for Magento 2 projects against Adobe Commerce Best Practices. DEPENDENT on
  magento2-dev-core for code-level performance patterns.
compatibility: claude, codex, opencode, copilot
depends: [magento2-dev-core]
metadata:
  audience: developers
  workflow: magento
---

# Magento 2 Performance Audit

This skill performs a comprehensive audit of Magento 2 performance, infrastructure, and code-level patterns.

> **This is a checklist, not a menu.** All 9 steps under **Workflow** (bottom of this file) run on every invocation — infra, indexer/cron, per-page-type capture, Slow Query Analysis, Cache Invalidation Efficiency, Client-Side AJAX Load, Core Web Vitals, code-level grep, report. Picking the steps that feel highest-signal for the effort and quietly dropping the rest (no admin creds, no Chrome DevTools MCP, "I already found a good bug") is the single most common failure mode of this skill — it produces a confident, well-formatted report that silently covers less than half the checklist. If a step genuinely can't run, say so *in the report, under that step's own heading* — `Skipped: <reason>` — never by omission. See the self-verification gate at the end of Workflow: the report is not done until it's been checked against the Audit Report Template line by line.

> **Distinguish a scoped ask from an unscoped one — this rule governs dropping steps quietly, not answering a narrower question.** A general ask — "audit performance", "review this project before launch" — is unscoped: all 9 steps apply, none optional, exactly as above. When the user's own words name one specific category instead ("just check the MySQL query count", "audit N+1s only", "how many queries does the homepage run"), scope the work to that category and its reference file(s) — running the other 8 steps anyway would be answering a different question than the one asked. The obligation that carries over unchanged: state the scope explicitly (a "Scope" line/heading in the report) so the result is never mistaken for a full audit, and don't let scope creep run in either direction — no silently expanding a scoped ask back to all 9 steps, and no silently narrowing an unscoped one down to whichever step already found something.

### Common ways this gets shortcut (don't)

| Rationalization | Reality |
|---|---|
| "Infra/cache/indexer checks already give strong signal, that's enough" | Slow Query Analysis, Cache Invalidation Efficiency, and Client-Side AJAX Load each catch bug classes the others structurally cannot see — one being clean says nothing about the others |
| "I already found a solid N+1, that's enough for a report" | A real finding proves the audit found *something*; it doesn't prove the mandatory steps ran. Finding a bug early is not a reason to stop the checklist |
| "One category and one product page is representative enough" | Only 3 differently-sized samples per type can surface the size-scaling N+1 signal (`references/per-page-type-audit.md`) — a single sample is provably unable to show it, however clean the one page looks |
| "This step needs admin credentials / a Chrome DevTools MCP I don't have" | Mark that section **unverified** with the reason, in the report — don't drop it from the conversation as if it were never in scope |
| "The draft report already has good findings, ship it" | Diff the draft against every checkbox in the Audit Report Template *before* presenting it as done — an unchecked box with no skip reason means the audit isn't finished, not that it's fine to omit |
| "This query shape (or profiler timer) repeats/is slow but I don't think it's a real bug" | Not your call to make silently — list it in the Repeated Query Shapes or Slowest Blocks/Templates table (`references/report-template.md`) with your assessment anyway. A borderline case left out of the report is indistinguishable from one that was never checked |
| "The user only asked about query counts, so I only ran that" | Correct *if* their own words named that one category — say so under a Scope heading. If their ask was general ("audit performance", "review this project"), this is the same shortcut as the rows above, just dressed up as scoping |

## Related Skills

**REQUIRED BACKGROUND:** Load `magento2-dev-core` first — code-level fixes for N+1 queries and heavy constructors follow the patterns it defines.

Part of the QA trio with `magento2-linter` and `magento2-security-scan` — together with `magento2-dev-core`, these form the "QA quartet" that `magento2-code-review` orchestrates at PR/module/theme/project scope. Findings use the shared `M2-PERF-xxx` codes cataloged in `magento2-dev-core/references/severity-and-codes.md`. Async/queue findings often point back to `magento2-backend-dev`.

## Audit Categories

Nine categories, each with full commands/thresholds/edge-cases in its own reference file — read the relevant file when executing that step of the Workflow below, not all up front:

| Category | Reference |
|---|---|
| Infrastructure, cache, indexer, async consumers, asset optimization, cron, security probes | `references/infrastructure-checks.md` |
| Core Web Vitals (LCP/INP/CLS, Chrome DevTools MCP trace, Lighthouse fallback) | `references/core-web-vitals.md` |
| Database query profiling: query-count tiers, query log setup, common issues, Slow Query Analysis | `references/database-query-profiling.md` |
| HTML profiler: block/template timing, tracing custom-code cost, cross-page-type signals | `references/html-profiler-audit.md` |
| Per-page-type audit (homepage + 3 category + 3 product samples, uncached) | `references/per-page-type-audit.md` |
| Cache invalidation efficiency (built-in FPC debug log + Varnish BAN tracing) | `references/cache-invalidation-audit.md` |
| Client-side AJAX/Customer Data load (sections.xml, reload storms) | `references/ajax-load-audit.md` |
| Code-level performance patterns (N+1, collection counting, heavy constructors, cache invalidation code) | `references/code-level-patterns.md` |
| Audit report template + self-verification checklist | `references/report-template.md` |

## Workflow

**When invoked, steps 1-9 are mandatory, run in order, none optional:**
1. Execute infrastructure checks (env.php, mode, cache status) — first confirm whether the target is local dev, staging, or production, since expectations differ. Full detail: `references/infrastructure-checks.md`
2. Run indexer status check, and verify cron is actually running/draining `cron_schedule`. Full detail: `references/infrastructure-checks.md`
3. Run the Per-Page-Type Audit — homepage plus 3 category (small/medium/large) and 3 product URLs — with `full_page`/`block_html`/`layout` caches disabled — verify each test page is representative first, then capture profiler + query log together, watch for a query count (and a slow block/template timer) that scales with grid size across the 3 category samples, then restore state. Full detail: `references/per-page-type-audit.md`, `references/database-query-profiling.md`, and `references/html-profiler-audit.md`
4. Run Slow Query Analysis (app-level `TIME:` sort, and/or MySQL's own slow_query_log for cron/import-triggered queries the app-level log can't see) — `EXPLAIN` any candidate before reporting it, and turn slow_query_log back off when done. Full detail: `references/database-query-profiling.md`
5. Trace cache invalidation efficiency — enable temporary logging (debug.log for built-in Redis/file FPC, varnishlog/ban.list for Varnish), reproduce one isolated save/action (or mark unverified if no admin credentials are available this session), and flag any custom code causing broad/frequent flushes beyond Magento's default targeted invalidation. Full detail: `references/cache-invalidation-audit.md`
6. Confirm which reactive/AJAX mechanism the project actually uses (sections.xml/Customer Data vs. Magewire/PWA/GraphQL or similar), then capture the AJAX footprint of a fresh/anonymous page load (Network tab) and audit accordingly — for sections.xml, check for overly broad Customer Data invalidation rules; these uncacheable requests are what crawler/bot JS execution multiplies regardless of FPC hit rate. Full detail: `references/ajax-load-audit.md`
7. Run Core Web Vitals audit (Chrome DevTools MCP trace preferred, Lighthouse as fallback) — when render delay dominates an LCP, read it per the JS-hydration guidance rather than assuming a network/image problem. Full detail: `references/core-web-vitals.md`
8. Scan `app/code` for code-level performance patterns using the grep recipes. Full detail: `references/code-level-patterns.md`
9. Draft the report with recommendations, prioritizing any finding that repeats across all 3 page types (site-wide impact) over page-specific ones — and populate the Repeated Query Shapes table (every shape repeated more than ~5 times per page load), the **Per-Page Query Detail** breakdown (the complete, unfiltered per-page query list — a standing report component, not optional), and the Slowest Blocks/Templates table (every profiler timer past the threshold in `references/html-profiler-audit.md`), not just the ones already confirmed as bugs. Template: `references/report-template.md`

**10. Self-verification gate — mandatory, run before presenting the report to the user:**

Walk the draft report against every checkbox in the Audit Report Template (`references/report-template.md`), one by one. For each checkbox, exactly one of these must be true:
- It's checked, with evidence for it visible somewhere above in the report (a command output, a query-log count, a traced file:line).
- It's unchecked, with an explicit `Skipped: <reason>` line next to it (missing credentials, no Chrome DevTools MCP, environment doesn't apply).

A checkbox that is simply absent from the report — not checked, not marked skipped, just not mentioned — means step 10 hasn't been done yet. Go back and either run the missing step or add the skip reason; don't publish or hand off the report in that state. Only once every checkbox resolves to one of the two states above is the audit actually finished — publish as a rendered artifact if the environment supports it (see `references/report-template.md`), otherwise markdown.
