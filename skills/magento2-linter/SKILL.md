---
name: magento2-linter
description: |
  This skill should be used when the user asks to "check coding standards", "run phpcs", "lint
  my code", "run PHPStan analysis", "run static analysis on this module", "find security
  issues in code", "check code complexity", "find code smells", "detect unused code", "audit
  custom code", or "verify code quality before commit". Runs automated code quality checks for
  Magento 2 projects — PHPCS (Magento2 standard), PHPStan, and PHPMD.
  DEPENDENT on magento2-dev-core for understanding the coding standards it validates.
compatibility: claude, codex, opencode, copilot
depends: [magento2-dev-core]
metadata:
  audience: developers
  workflow: magento
---

# Magento 2 Linter

This skill runs automated code quality checks to verify Magento 2 coding standards compliance.

## Related Skills

**REQUIRED BACKGROUND:** Load `magento2-dev-core` first — this skill validates code against the coding/security standards that skill defines, and its patterns are what you fix findings with.

Part of the QA trio with `magento2-security-scan` (deeper vulnerability scanning) and `magento2-performance-audit` (runtime/infrastructure checks) — run all three before a release. Fix findings using the patterns in `magento2-dev-core` (or the relevant frontend/backend/Hyvä skill).

## Real CI Verification Is Mandatory Before Pushing

If the project has a real CI wrapper for linting (e.g. Sutunam's `magelint` — see "Check the
Project's Real CI Setup First" below), running it for real is a **required step before pushing or
opening a PR/MR, not an optional nice-to-have**. A local approximation (isolated scratch install,
`bootstrapFiles` pointed at a host project's autoload, or any other stand-in for the actual
per-PHP-version isolated install the CI runs) is a fast pre-check to catch obvious problems early
— it is not proof the branch is clean, because it can diverge from the real run in either
direction (see the finding-triage callout under "Check the Project's Real CI Setup First").

Before telling the user a branch is "verified" or "ready to push": either run the real CI
wrapper yourself if credentials/access allow, or explicitly ask the user to run it and wait for
the result. Never substitute a local approximation's "0 errors" for that confirmation, and never
present local-only results as if they were the real gate having passed.

## Prerequisites

Ensure the project has required tools:

```bash
# PHPCS (Magento Coding Standard)
composer require --dev magento/magento-coding-standard --no-interaction

# PHPStan (Magento extension)
composer require --dev bitexpert/phpstan-magento --no-interaction
```

## Check the Project's Real CI Setup First

Don't assume a bare `vendor/bin/phpcs` / `vendor/bin/phpstan` invocation matches what the
project's CI pipeline actually enforces. Many teams wrap these tools in a shared script or CI
template that installs Magento-aware PHPStan extensions, changes exclusions, or installs the
module in isolation — none of which show up if you just run the tools directly against the code
sitting inside a large host project.

**On one real audit**, `phpstan.neon` had inline `@phpstan-ignore` comments. A bare local
`vendor/bin/phpstan` run (no extensions installed) reported them as "unmatched" — looking stale,
since nothing in that run triggered the errors they were suppressing — and they got deleted as
cleanup. The project's actual CI ran a wrapper script that installed
`bitexpert/phpstan-magento` (the extension this skill's own Prerequisites section already lists) —
a Magento-aware PHPStan extension that resolves magic getters/setters and factory return types
that vanilla PHPStan can't see. With the extension active, those exact lines fired again as real
errors; the "cleanup" had silently reopened them. Two habits prevent this:

1. **Search for the project's CI config before trusting a local run**: `.gitlab-ci.yml`,
   `.github/workflows/`, or a referenced shared template/script. If it calls a wrapper script
   (not the raw binaries), read that script — it's the actual spec for what "passing" means,
   not whatever flags feel conventional for a bare `phpstan analyse`.
2. **Install the same PHPStan extensions the CI does** (check the wrapper script or a shared CI
   template for `phpstan/extension-installer` plus any `*/phpstan-*` packages, e.g.
   `bitexpert/phpstan-magento`) before deciding an `@phpstan-ignore` comment is stale or a
   finding is a false positive. A bare install without Magento-aware extensions reports far more
   "undefined method" noise than real CI ever sees, AND can hide real findings that only surface
   once those extensions are active — verify both ways before touching an ignore list.

> **New findings that share an error message with an already-tolerated pattern still need their
> own check — don't dismiss a whole batch by shape alone.** On one real fix, several new findings
> got bucketed with older, already-accepted ones as "same pattern, not worth fixing." The real CI
> run disagreed: only one of the *dismissed* findings actually failed it, and none of the old ones
> it was grouped with did. Verify each new finding against what real CI reports, not against how
> similar its wording looks to already-tolerated noise.

## Standalone Composer Packages Need Isolated Verification

If the module under test is a standalone Composer package (own `composer.json`, developed as its
own git repo, installed into a host project's `vendor/<vendor>/<package>`) rather than an
in-project `app/code/` module, running phpcs/phpstan against it *nested inside* a large host
project can give misleading results in both directions:
- PHPStan may resolve the host project's own `generated/code/` factory classes and report a
  narrower set of errors than the package's own CI ever sees, because a standalone package
  install has no `generated/` directory at all (no `bin/magento` context to generate one).
- Conversely it may fail to resolve classes the package's own dependency tree would otherwise
  provide, because the host project's autoloader silently takes precedence.

To match what real per-package CI actually sees, install the module **in isolation** first: copy
it (excluding `.git`, `vendor`, `composer.lock`) into a scratch directory, run
`composer install --no-dev` there against its own `composer.json`, and run phpcs/phpstan against
that isolated copy instead of (or in addition to) the nested `vendor/` path. This is exactly what
a package-level CI runner typically does, and it's the only way to catch host-project-only false
negatives/positives before they surface in the real pipeline.

> **`cd` into the scratch directory before invoking phpstan — isolating the `vendor/` being
> analysed isn't enough on its own.** PHPStan auto-detects `vendor/autoload.php` relative to the
> *current working directory*, not relative to wherever `-c`/`--configuration` points. On one
> real check, phpstan was invoked as `php <tools>/vendor/bin/phpstan analyse -c
> <scratch>/magelint.neon <scratch>` from the *host* project's directory — it silently picked up
> the host's own `vendor/autoload.php` (which had `phpunit/phpunit` installed for the host's own
> test suite) instead of the scratch copy's. The isolated check reported 0 errors; the real CI,
> run directly, reported 121 — every test class extending PHPUnit's `TestCase` had cascaded into
> "undefined method" findings once the *actual* isolated autoloader (with no PHPUnit available)
> was in play. Always `cd` into the scratch directory first, then invoke phpcs/phpstan from
> there — don't just point `-c`/a target path at it from elsewhere.

> **A standalone package's `Test/` directory can be unanalysable under a real `--no-dev` CI
> install, even with correct isolation.** `phpunit/phpunit` is what makes
> `Magento\Framework\TestFramework\Unit\BaseTestCase` (and `PHPUnit\Framework\TestCase` itself)
> resolvable, but it only belongs in `require-dev` — and `--no-dev` skips it, so a package that
> never explicitly requires it (the common case: Magento doesn't force this dependency on you)
> will always fail to resolve every test class once truly isolated, independent of anything in
> the package's own code. Putting `phpunit/phpunit` in a real `require` "fixes" this but bloats
> every production install of the package with a test framework — not a trade worth making just
> to satisfy a lint pass. If the CI's install step can't be changed to include dev dependencies,
> the pragmatic fix is excluding `Test/` from that package's own `phpstan.neon`
> (`excludePaths: [Test/*]`) with a comment explaining why, rather than chasing a dependency
> placement that doesn't actually fix anything under `--no-dev`.

> **When the package uses a `src/`-rooted PSR-4 layout, `Test/` belongs inside `src/`, not next to
> it.** If `composer.json` maps the module's namespace to `src` (e.g. `"Vendor\\Module\\": "src"`),
> test classes need that same root to autoload — so `Test/` has to live at `src/Test/...`, not as
> a sibling directory at the package root. Placed outside `src/`, it silently fails to autoload,
> and a phpstan config scoped to `paths: [src]` will skip it entirely without any error, giving a
> false sense of full coverage.

## Capabilities

### 1. PHPCS (Magento2 Ruleset)

Runs the official Magento coding standard against PHP, PHTML, and XML files.

**What it checks:**
- PSR-12 compliance
- Magento-specific patterns (class names, method names, property names)
- License headers
- Docblock completeness
- Line length limits

### 2. PHPStan (Static Analysis)

Runs deep static analysis with Magento magic class handling.

**What it checks:**
- Type safety violations
- Undefined method/property access
- Dead code detection
- Logic errors
- Unused parameters

### 3. Security Pattern Detection

Scans for common anti-patterns that PHPCS might miss.

**Detected patterns:**

| Pattern | Issue | Risk | Code |
|---------|-------|------|------|
| `SELECT * FROM` | Direct SQL | Medium | M2-ARCH-004 |
| `ObjectManager::getInstance` | Service Locator | Critical | M2-ARCH-001 |
| `$_GET`, `$_POST`, `$_REQUEST` | Superglobal access | High | M2-SEC-006 |
| `eval()` | Code execution | Critical | M2-SEC-007 |
| `base64_decode` on user input | Obfuscation | High | M2-SEC-008 |
| `file_get_contents($userInput)` | Path traversal | High | M2-SEC-009 |

Full scale and code catalogue: `magento2-dev-core/references/severity-and-codes.md`.
Two rows cite `M2-ARCH-xxx` codes rather than a `M2-SEC-xxx` one:
`ObjectManager::getInstance` cites `M2-ARCH-001` — the same underlying
pattern `magento2-dev-core` already catalogues, cited from here rather than
duplicated under a second code. `SELECT * FROM` cites `M2-ARCH-004` ("Raw
SQL outside a ResourceModel") rather than `M2-SEC-001` ("SQL Injection... with
user input") — this bare-string grep can't confirm user input is actually
involved, so it's the weaker raw-SQL-usage finding, not a confirmed
injection; `magento2-security-scan`'s own SQL Injection checks (which do
correlate with user input) are what earns `M2-SEC-001`.

### 4. PHPMD (Code Smell & Complexity)

Catches cyclomatic complexity, unused code, and code smells that PHPCS
(style) and PHPStan (types) don't check for — a 200-line method or a
15-parameter constructor passes both of those clean.

**Prerequisite:**

```bash
composer require --dev phpmd/phpmd --no-interaction
```

**Run it:**

```bash
govard sh -c "vendor/bin/phpmd app/code/Vendor/Module text phpmd.xml"
```

**What it checks (default ruleset — tune via a project `phpmd.xml`):**

| Check | Flags | Code |
|---|---|---|
| Cyclomatic complexity | Methods with too many branches/paths | M2-STYLE-001 |
| NPath complexity | Combinatorial explosion of execution paths | M2-STYLE-001 |
| Excessive method/class length | Methods/classes past a line-count threshold | M2-STYLE-002 |
| Excessive parameter lists | Constructors/methods with too many parameters | M2-STYLE-003 |
| Unused code | Unused local variables, parameters, private methods/fields | M2-STYLE-004 |
| Naming | Short/non-descriptive variable names | M2-STYLE-005 |

Full scale and code catalogue: `magento2-dev-core/references/severity-and-codes.md`.

No auto-fix — every PHPMD finding needs a manual refactor (usually: extract
method, reduce constructor dependencies via a factory/proxy, or delete dead
code).

## Usage

### Basic Scan

Run against custom modules:

```bash
# PHPCS only
vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module --colors

# PHPStan only
vendor/bin/phpstan analyse app/code/Vendor/Module -c phpstan.neon --memory-limit=1G

# Both (recommended)
vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module && \
vendor/bin/phpstan analyse app/code/Vendor/Module -c phpstan.neon
```

### Targeted Scan

Scan specific file types:

```bash
# PHP files only
vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module --extensions=php

# PHTML templates
vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module --extensions=phtml

# XML (layout, config)
vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module --extensions=xml,xsl
```

### In Govard Environment

```bash
govard sh -c "vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module"
govard sh -c "vendor/bin/phpstan analyse app/code/Vendor/Module -c phpstan.neon"
```

## Scoping

Accepts either a directory (the examples above) or an explicit space-separated
file list — both PHPCS and PHPStan take file arguments natively:

```bash
vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module/Model/Foo.php app/code/Vendor/Module/Model/Bar.php
vendor/bin/phpstan analyse app/code/Vendor/Module/Model/Foo.php app/code/Vendor/Module/Model/Bar.php -c phpstan.neon
```

The Security Pattern Detection greps need the same file list looped instead
of a directory glob:

```bash
for f in app/code/Vendor/Module/Model/Foo.php app/code/Vendor/Module/Model/Bar.php; do
  grep -Hn "ObjectManager::getInstance\|\$_GET\|\$_POST\|\$_REQUEST\|eval(" "$f"
done
```

`magento2-code-review` derives this file list from a git diff or an MR fetch
and calls this skill with it directly — the git/glab mechanics themselves
live there, not here.

## Interpreting Results

The examples below show clean, isolated tool output. On PHP 8.4+ (PHPCS
3.5.8 and older PHPMD/PHPStan builds included), running these commands for
real against a modern stack commonly prints dozens of lines of
`Deprecated: strpos(): Passing null...`-style PHP-8.4-compatibility notices
mixed in with the actual findings — this is noise from the tool's own code,
not a project finding, and it does not change the tool's exit code. Never
judge success/failure by whether the output "looks like" the clean examples
below; always check the real exit code explicitly:

```bash
vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module; echo "EXITCODE:$?"
```

A batch run that's actually clean still exits `0` underneath the
deprecation noise — an exit-code check is what tells the two apart, not the
shape of the printed output.

### PHPCS Output

```
FILE: app/code/Vendor/Module/Controller/Index/Index.php
---------------------------------------------------------------------------
FOUND 3 ERRORS AFFECTING 2 LINES
---------------------------------------------------------------------------
 12 | ERROR | Missing license header
 45 | ERROR | [x] Expected 1 space after TYPE hint; 0 found
 67 | ERROR | [x] Public property name "_products" must not be prefixed with
      |       | an underscore
---------------------------------------------------------------------------
```

### PHPStan Output

```
 ------ ---------------------------------------------------------------
  Line   Model/ProductRepository.php
 ------ ---------------------------------------------------------------
  23     Call to an undefined method ProductInterface::getSkuAttribute().
         💡 Did you mean getCustomAttribute()?
 ------ ---------------------------------------------------------------

 [ERROR] 1 error
```

### Security Findings

```
⚠️  Security Pattern Detected
File: app/code/Vendor/Module/Controller/SearchController.php:34
Pattern: $_GET
Recommendation: Use Magento\Framework\App\RequestInterface

⚠️  Direct SQL Query
File: app/code/Vendor/Module/Model/ResourceModel/Custom.php:12
Recommendation: Use Collection or Repository
```

## Auto-fix Capabilities

Some PHPCS issues can be auto-fixed:

```bash
# Auto-fix fixable issues
vendor/bin/phpcbf --standard=Magento2 app/code/Vendor/Module

# Common auto-fixable issues:
# - Line ending normalization
# - Trailing whitespace
# - PSR-12 formatting
# - Docblock formatting
```

**Note:** PHPStan cannot auto-fix issues - requires manual correction.

## CI Integration

### GitHub Actions

```yaml
name: Code Quality
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: php-actions/composer@v6
      - name: Run PHPCS
        run: vendor/bin/phpcs --standard=Magento2 app/code
      - name: Run PHPStan
        run: vendor/bin/phpstan analyse app/code -c phpstan.neon
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running code quality checks..."

vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module
if [ $? -ne 0 ]; then
    echo "PHPCS failed. Please fix errors before committing."
    exit 1
fi

vendor/bin/phpstan analyse app/code/Vendor/Module -c phpstan.neon
if [ $? -ne 0 ]; then
    echo "PHPStan failed. Please fix errors before committing."
    exit 1
fi

echo "Code quality checks passed!"
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | PHPCS errors found |
| 2 | PHPStan errors found |
| 3 | Both PHPCS and PHPStan errors |
| 4 | Missing dependencies |

## Workflow Integration

This skill should be run:
- **Before commits** (use pre-commit hooks)
- **In CI/CD pipelines**
- **During code review**
- **After major refactoring**

For complete codebase audit including performance, see `magento2-performance-audit` skill.