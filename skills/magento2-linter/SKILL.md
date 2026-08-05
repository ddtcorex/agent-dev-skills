---
name: magento2-linter
description: |
  This skill should be used when the user asks to "check coding standards", "run phpcs", "lint
  my code", "run PHPStan analysis", "run static analysis on this module", "find security
  issues in code", "audit custom code", or "verify code quality before commit". Runs automated
  code quality checks for Magento 2 projects — PHPCS (Magento2 standard) and PHPStan.
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

| Pattern | Issue | Risk |
|---------|-------|------|
| `SELECT * FROM` | Direct SQL | High |
| `ObjectManager::getInstance` | Service Locator | High |
| `$_GET`, `$_POST`, `$_REQUEST` | Superglobal access | High |
| `eval()` | Code execution | Critical |
| `base64_decode` on user input | Obfuscation | High |
| `file_get_contents($userInput)` | Path traversal | High |

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

## Interpreting Results

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