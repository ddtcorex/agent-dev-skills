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

```bash
glab mr diff <id>       # GitLab
gh pr diff <number>      # GitHub
```

**What this can and cannot run:**

| Check | Works against a raw diff? |
|---|---|
| Text-pattern greps (`ObjectManager::getInstance`, superglobals, `eval()`, missing `escapeHtml`/`escapeUrl`/etc., raw SQL) | Yes — these are string matches against the diff text |
| PHPCS | No — needs the file on disk to resolve full-file context (e.g. license header position, surrounding indentation) |
| PHPStan / PHPMD | No — both need a real `vendor/autoload.php` and the full class graph; a diff hunk alone can't resolve types or cross-file usage |

State this limitation explicitly in the report's "Coverage note" — never let
a remote-fetch review read as if it ran the same checks as a local one.

## Govard-first commands used at this scope

```bash
# Pre-flight sanity check before a project/module-scope review
govard tool magerun sys:check
# or the alias:
govard tool mr sys:check

# Admin-account context for security-scan's Authentication & Authorization checks
govard tool magerun admin:user:list
```
