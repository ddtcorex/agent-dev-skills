# Scope Modes — mechanics

## Full path / explicit file list

No special handling — pass the path or file list straight to
`magento2-linter`/`magento2-security-scan` per their own "Scoping" sections,
and to `magento2-performance-audit`/theme routing for project/theme scope.

## Local git diff

Run inside the checked-out Govard project (the code needs to be on disk, in
the container, for PHPCS/PHPStan/PHPMD/magerun to see it):

```bash
git diff --name-only --diff-filter=ACMR <base>...<head> -- '*.php' '*.phtml' '*.xml' '*.js' '*.less' '*.css' '*.graphqls'
```

- `<base>` is typically `origin/master` (or the project's actual default
  branch — check, don't assume `master`); `<head>` is the branch under review.
- `--diff-filter=ACMR` excludes deleted files (D) — nothing to lint in a file
  that no longer exists.
- Feed the resulting list straight into the "Explicit file list" handling of
  each trio member. Everything can run: PHPCS, PHPStan, PHPMD, the security
  greps, and `govard tool magerun`/`mr` commands.
- Only the files in this list are analyzed; a pre-existing violation in a
  touched file, outside the changed lines, is still worth surfacing but must
  be reported separately from violations the diff itself introduces — don't
  block a PR on legacy debt the diff didn't create. A
  `git diff -U0 <base>...<head> -- <file>` on a specific file shows exactly
  which lines changed, to tell the two apart.

## Remote fetch (no checkout)

**GitHub MCP (preferred, if connected and the target is a GitHub PR):** use
`pull_request_read` to fetch the diff instead of shelling out to `gh pr
diff`. If the user wants findings posted back to the PR rather than only
printed as a markdown report, use `pull_request_review_write` to open a
pending review and `add_comment_to_pending_review` to attach each finding
as an inline comment, then submit the review.

**CLI fallback (GitHub without MCP connected, or any GitLab target — no
GitLab MCP is available):**

```bash
glab mr diff <id>       # GitLab
gh pr diff <number>      # GitHub
```

Both paths produce the same diff text for the checks below — GitHub MCP is
a preference, not a requirement; every capability in this section works
end-to-end through the CLI fallback alone.

**What this can and cannot run:**

| Check | Works against a raw diff? |
|---|---|
| Text-pattern greps (`ObjectManager::getInstance`, superglobals, `eval()`, missing `escapeHtml`/`escapeUrl`/etc., raw SQL) | Yes — these are string matches against the diff text |
| PHPCS | No — needs the file on disk to resolve full-file context (e.g. license header position, surrounding indentation) |
| PHPStan / PHPMD | No — both need a real `vendor/autoload.php` and the full class graph; a diff hunk alone can't resolve types or cross-file usage |

State this limitation explicitly in the report's "Coverage note" — never let
a remote-fetch review read as if it ran the same checks as a local one.

## Performance/theme checks by scope

Scope gating must never reduce PR/MR-scope performance or theme coverage to
zero — a diff titled "Optimize AJAX requests," or one touching several Hyvä
templates, deserves more than "not run because scope isn't project/module."
Split by whether a check needs a live environment or just the touched files:

**Static, file-scoped — run at every scope, including PR/MR (local diff or
remote fetch):**

- `magento2-performance-audit/references/code-level-patterns.md`'s grep
  recipes (Workflow step 8: N+1 shapes, `count($collection)`,
  `cacheable="false"`) — always, against whatever file list is in scope.
- If the file list touches `sections.xml`, a Customer Data section
  provider, or AJAX/reload wiring: read (don't reproduce) the invalidation
  rules per `magento2-performance-audit/references/ajax-load-audit.md`'s
  sections.xml checks — there's no Network tab to capture without a
  running page, so this is a static read of rule breadth, not the live
  footprint measurement the rest of that workflow step also does.
- If the file list touches a Hyvä/Luma theme file: the static half of
  `references/theme-audit-checks.md` — the CSP nonce/pattern check
  (missing `registerInlineScript()` before an inline `<script>`, per
  `magento2-hyva-dev`'s CSP section) and the Alpine hydration-root count
  (`M2-THEME-002`: `grep -o 'x-data' <file>.phtml | wc -l` per touched
  template) — no build required for either.

**Live/infra, needs a checked-out running environment — project, module, or
theme scope only; genuinely cannot run against a bare diff or remote
fetch:**

- `magento2-performance-audit`'s infra checks, per-page-type audit, slow
  query analysis, cache invalidation trace, and Core Web Vitals trace
  (Workflow steps 1-3, 4, 5, 7).
- `references/theme-audit-checks.md`'s Tailwind bundle-size regression
  (`M2-THEME-001`) and RequireJS/LESS output-size regression
  (`M2-THEME-003`) — both need a real build/deploy to measure.

At PR/MR scope, state in the report's Coverage note which live/infra checks
above did not run and why — never let a diff-scope report read as if it
covered Core Web Vitals or infra when it only ran the static subset.

## Govard-first commands used at this scope

```bash
# Pre-flight sanity check before a project/module-scope review (see
# govard-magento's Diagnostics section for the full command set)
govard tool magerun sys:check
# or the alias:
govard tool mr sys:check

# Admin-account context for security-scan's Authentication & Authorization checks
govard tool magerun admin:user:list
```
