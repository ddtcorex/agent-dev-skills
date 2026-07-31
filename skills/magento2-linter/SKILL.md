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