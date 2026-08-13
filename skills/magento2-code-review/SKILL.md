---
name: magento2-code-review
description: |
  This skill should be used when the user asks to "review this PR/MR",
  "review this merge request", "review this module", "audit this module
  before merge", "review this theme", "audit this theme PR", or wants a
  "full review before release". Orchestrates a PR/MR, module, theme, or
  full-project code review by running the QA trio (magento2-linter,
  magento2-security-scan, magento2-performance-audit) and
  magento2-dev-core's anti-pattern checks at the right scope, then merges
  their findings into one report using a shared severity scale and stable
  finding codes. DEPENDENT on magento2-dev-core; invokes magento2-linter,
  magento2-security-scan, and magento2-performance-audit as needed for the
  chosen scope.
compatibility: claude, codex, opencode, copilot
depends: [magento2-dev-core]
metadata:
  audience: tech leads, reviewers
  workflow: magento
  requires: [magento2-linter, magento2-security-scan, magento2-performance-audit]
---

# Magento 2 Code Review

Orchestrates a review at one of four scopes — PR/MR, module, theme, or whole
project — by calling the existing QA trio and `magento2-dev-core` at the
right scope, then merging their output into one report with one severity
scale. This skill does not reimplement any check the trio already owns.

## Related Skills

**REQUIRED BACKGROUND:** Load `magento2-dev-core` first — its
`references/severity-and-codes.md` defines the severity scale and finding
codes this skill's report uses.

Invokes `magento2-linter` (style/static analysis), `magento2-security-scan`
(vulnerability scanning), and `magento2-performance-audit` (runtime/
infrastructure) at whichever scope is in play — see "Scope modes" below.
Theme scope additionally cross-references `magento2-hyva-dev` (CSP) and
`magento2-frontend-dev` (Luma build/verify); it does not duplicate their
content. Together with the trio, this forms the "QA quartet" — the four
skills expected to run before a release.

## Scope modes

| Mode | Trigger phrase example | File list source |
|---|---|---|
| Full path | "review this module/project" | module/theme/`app/code` path, as today |
| Explicit file list | caller already knows which files | passed straight through |
| Local git diff | "review this PR", branch already checked out | `git diff` against a base ref |
| Remote fetch | "review MR !123 before I check it out" | GitHub MCP (`pull_request_read`, preferred for GitHub) / `glab mr diff` / `gh pr diff` — **text-pattern checks only**, see below |

Full mechanics, exact commands, and the remote-fetch limitation:
`references/scope-modes.md`.

## Workflow

1. Determine scope (ask if ambiguous — a bare "review this" with no target
   and no diff in the working tree is not enough to guess from).
2. Resolve the scope to a file list per `references/scope-modes.md`.
3. Run `magento2-linter` and `magento2-security-scan` against that file list
   (see each skill's own "Scoping" section for how they accept a list vs. a
   path).
4. If scope is project or module, also run `magento2-performance-audit`'s
   applicable steps; if scope is theme, run the theme-scope routing in
   `references/theme-audit-checks.md` instead of the full 9-step audit.
5. If the file list touches `di.xml`, `events.xml`, a `Plugin/` class, or an
   `Observer/` class, run the conflict check in
   `references/plugin-observer-conflict-check.md`.
6. Merge every finding into the report template below, using
   `magento2-dev-core/references/severity-and-codes.md` — map to an existing
   code before minting a new one.
7. **Self-verification gate (mandatory, before presenting the report):** the
   Summary table's per-severity counts must equal the number of findings
   actually listed below it — recount by hand if they don't match, the same
   discipline `magento2-performance-audit` already requires of its own
   report.

## Report template

```markdown
## Code Review Report

**Scope**: [PR #123 / app/code/Vendor/Module / Vendor/theme / full project]
**Mode**: [full path / file list / local git diff / remote fetch]

### Summary

| Severity | Count |
|---|---|
| Critical | N |
| High | N |
| Medium | N |
| Low | N |

### Findings

- **[Code]** [severity] — `file:line` — [one-line description] — fix: [what to change]

### Coverage note

[If mode=remote fetch: state explicitly that PHPStan/PHPMD did not run —
text-pattern checks only. If any trio member's step was skipped, say
`Skipped: <reason>` here rather than omitting it.]
```
