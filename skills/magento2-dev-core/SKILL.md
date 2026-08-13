---
name: magento2-dev-core
description: |
  This skill should be used when the user is creating new Magento 2 modules or customizations,
  implementing features following Magento architecture, working with Dependency Injection,
  Repositories, or Plugins, writing secure Magento code, or building backend logic, CLI
  commands, or cron jobs. Foundation skill for professional Magento 2 development. This is the
  CORE skill that other Magento 2 skills depend on. Always load this first.
compatibility: claude, codex, opencode, copilot
metadata:
  audience: developers
  workflow: magento
  requires: [magento2-linter, magento2-performance-audit]
---

# Magento 2 Developer Core

This skill provides the foundational patterns all Magento 2 developers must follow. It covers architectural decisions, security, and best practices that apply to every part of a Magento project.

## Related Skills

This is the foundation the other Magento 2 skills build on: `magento2-frontend-dev` and `magento2-hyva-dev` cover the two mutually exclusive theme stacks (check the theme's `theme.xml` parent to see which one the project actually uses — Luma vs Hyvä), `magento2-backend-dev` covers APIs/CLI/cron, and `magento2-linter`, `magento2-security-scan`, `magento2-performance-audit` verify the patterns below — `magento2-code-review` orchestrates all three (plus this skill's own anti-pattern checks) into one report scoped to a PR/module/theme/project. In a Govard environment, pair this with `govard-magento` for the container/CLI side.

## Core Architectural Standards

### Dependency Injection (DI)

**DO**: Use Constructor Injection for all dependencies.

```php
class MyService
{
    public function __construct(
        private readonly ProductRepositoryInterface $productRepository,
        private readonly LoggerInterface $logger
    ) {}

    public function getProduct(int $id): ?ProductInterface
    {
        return $this->productRepository->get($id);
    }
}
```

**NEVER**: Use `ObjectManager::getInstance()` (Service Locator anti-pattern).

```php
// WRONG - Never do this
$objectManager = \Magento\Framework\App\ObjectManager::getInstance();
$product = $objectManager->create(Product::class);

// CORRECT
public function __construct(ProductFactory $productFactory) {
    $this->productFactory = $productFactory;
}
```

### Service Contracts

Always prefer interfaces in `Api/` folders over concrete classes:

```php
// WRONG
public function __construct(Product $product) { }

// CORRECT
public function __construct(ProductInterface $product) { }
```

### Repositories

Always use repositories for data operations. Never call `load()`, `save()`, or `delete()` directly on models.

```php
// WRONG
$product = $this->productFactory->create();
$product->load($id);

// CORRECT
$product = $this->productRepository->getById($id);

// WRONG
$this->productFactory->create()->save($product);

// CORRECT
$this->productRepository->save($product);
```

### Plugins (Interceptors)

Prefer `before` and `after` plugins over `around` plugins:

| Plugin Type | Use Case |
|-------------|----------|
| `before` | Modify arguments before method execution |
| `after` | Modify return value after method execution |
| `around` | **Avoid unless necessary** - blocks original method execution |

```php
// Prefer this pattern
public function beforeExecute(
    SaveProduct $subject,
    ProductInterface $product
): array {
    // Validate or modify $product before save
    return [$product];
}

// Instead of around plugins that wrap the entire method
```

Plugins only intercept **public** methods, must be stateless, and should not target a module's own classes or data objects. Register them in `di.xml` with an explicit `sortOrder` when order matters. Observer order is *not* guaranteed by contrast — if the sequence matters, use a plugin instead of an observer. Before adding a new plugin or observer, check for existing ones on the same target class/event — `magento2-code-review`'s plugin/observer conflict check (`references/plugin-observer-conflict-check.md` in that skill) covers the grep procedure.

### Declarative Schema

Use `db_schema.xml` for all database changes. Never modify database directly:

```xml
<!-- app/code/Vendor/Module/etc/db_schema.xml -->
<?xml version="1.0"?>
<schema xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:noNamespaceSchemaLocation="urn:magento:framework:Setup/Declaration/Schema/etc/schema.xsd">
    <table name="vendor_module_custom_table" resource="default">
        <column xsi:type="int" name="id" padding="10" unsigned="true" nullable="false" identity="true"/>
        <column xsi:type="varchar" name="name" nullable="false" length="255"/>
        <column xsi:type="timestamp" name="created_at" nullable="false" init="current"/>
        <constraint xsi:type="primary" referenceId="PRIMARY">
            <column name="id"/>
        </constraint>
    </table>
</schema>
```

## Coding Standards

### PHPCS (Magento2 Ruleset)

| Rule | Example |
|------|---------|
| Class naming | `PascalCase` - `ProductRepository` |
| Method naming | `camelCase` - `getProductById()` |
| Property naming | `snake_case` - `$product_id`, `$_cacheIdPrefix` |
| Visibility | Always explicit - `public`, `protected`, or `private` |
| Indentation | 4 spaces (no tabs) |
| Line endings | LF (Unix) |

### PHPStan Requirements

Always run PHPStan at level 6+ using `bitexpert/phpstan-magento` for Magento's magic classes.

```bash
# In a Govard environment
govard sh -c "vendor/bin/phpstan analyse app/code -c phpstan.neon"
```

### Strict Typing

Always include at the top of new PHP files:

```php
<?php
declare(strict_types=1);
```

## Security Standards

### No Superglobals

**NEVER** use `$_GET`, `$_POST`, `$_REQUEST`, `$_SESSION`, `$_COOKIE` directly.

```php
// WRONG
$id = $_GET['id'];

// CORRECT - Use RequestInterface
public function __construct(
    private readonly \Magento\Framework\App\RequestInterface $request
) {}

$id = (int) $this->request->getParam('id');
```

### XSS Prevention

Always escape output in templates:

```php
// HTML content
<?= $escaper->escapeHtml($userInput) ?>

// HTML attributes
<div data-id="<?= $escaper->escapeHtmlAttr($id) ?>">

// JavaScript strings
<script>var name = '<?= $escaper->escapeJs($productName) ?>';</script>

// URLs
<a href="<?= $escaper->escapeUrl($url) ?>">

// CSS values
<div style="color: <?= $escaper->escapeCss($color) ?>">
```

The `Magento2.Security.XssTemplate` PHPCS sniff treats any method whose name contains `html` (e.g. `getLabelHtml()`) as already safe — do not wrap it in `escapeHtml()` again, that double-escapes the output.

### CSRF Protection

Include form key in all forms:

```php
<form action="<?= $escaper->escapeUrl($block->getSubmitUrl()) ?>" method="post">
    <?= $block->getBlockHtml('formkey') ?>
</form>
```

### Discouraged Functions

Use Magento wrappers instead of native PHP:

| Native PHP | Use Instead |
|------------|-------------|
| `serialize/unserialize` | `SerializerInterface` |
| `json_encode/decode` | `\Magento\Framework\Serialize\Serializer\Json` |
| `curl_*` | `Magento\Framework\HTTP\ClientInterface` |
| `date()`, `time()` | `\Magento\Framework\Stdlib\DateTime\DateTime` |
| `md5()`, `sha1()` | `EncryptorInterface` |

## Verification Workflow

Run these checks before completing any backend task:

```bash
# 1. PHPCS Linting
vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module

# 2. PHPStan Analysis
vendor/bin/phpstan analyse app/code/Vendor/Module -c phpstan.neon

# 3. DI Compilation
bin/magento setup:di:compile

# 4. Flush cache
bin/magento cache:flush
```

## Usage Patterns

### Creating a Module

1. Create registration file: `app/code/Vendor/Module/registration.php`
2. Create `etc/module.xml` with correct sequence
3. Define `etc/di.xml` for preferences and plugins
4. Use `db_schema.xml` for database schema
5. Run `bin/magento module:enable Vendor_Module`

### CLI Commands

```php
// etc/di.xml
<type name="Magento\Framework\Console\CommandList">
    <arguments>
        <argument name="commands" xsi:type="array">
            <item name="vendor_module_sync" xsi:type="object">Vendor\Module\Console\Command\SyncCommand</item>
        </argument>
    </arguments>
</type>
```

### Cron Jobs

```xml
<!-- etc/crontab.xml -->
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:noNamespaceSchemaLocation="urn:magento:module:Magento_Cron:etc/crontab.xsd">
    <group id="default">
        <job name="vendor_module_cleanup" instance="Vendor\Module\Cron\Cleanup" method="execute">
            <schedule>0 2 * * *</schedule>
        </job>
    </group>
</config>
```

## Configuration File Reference

Quick lookup for what each `etc/` XML file controls:

| File | Purpose |
|------|---------|
| `di.xml` | Dependency injection: preferences, plugins, virtual types |
| `events.xml` | Observer registration |
| `crontab.xml` / `cron_groups.xml` | Cron jobs / cron group tuning |
| `acl.xml` | Admin permission tree |
| `routes.xml` | Frontend/adminhtml controller routing |
| `webapi.xml` | REST route declarations |
| `system.xml` | Admin configuration fields |
| `config.xml` | Default config values |
| `indexer.xml` + `mview.xml` | Indexer declaration + its change tracker (enables schedule mode) |
| `extension_attributes.xml` | Extend a core entity without a preference |
| `view.xml` | Theme image/gallery sizing, layout config |
| `queue.xml` / `communication.xml` | Message queue publishers, consumers, topics |
| `widget.xml` | CMS widget declaration |
| `email_templates.xml` | Transactional email template registration |

**Rule of thumb**: stale *data* is an indexer problem (check `indexer:status`); stale *output* is a cache problem (`cache:clean`/`cache:flush`). Diagnose in that order rather than assuming a cache bug.

## Anti-Pattern Severity (for code review)

Full severity scale and stable finding codes (shared with `magento2-linter`,
`magento2-security-scan`, `magento2-performance-audit`, and
`magento2-code-review`): `references/severity-and-codes.md`. The
architecture anti-patterns this skill defines are catalogued there under the
`M2-ARCH-xxx` namespace — map a new finding to an existing code before
minting a new one.

## Testing Conventions

- **Unit tests** (`Test/Unit/`): typed mocks only, never `ObjectManager::getInstance()`, never test private methods via reflection — if a private method needs its own test, it belongs in its own class.
- **Integration tests** (`Test/Integration/`): use `Bootstrap::getObjectManager()`, load data with `@magentoDataFixture` fixture files rather than creating entities inline, and annotate with `@magentoDbIsolation` so tests don't leak state between each other.
- **Functional tests**: MFTF (Magento Functional Testing Framework) for full user-journey coverage.

## References

For detailed patterns, see:
- `references/coding-standards.md` - Extended PHPCS/PHPStan guide
- `references/architecture-patterns.md` - Service contracts, repositories, plugins
- `references/security-best-practices.md` - Security checklist and patterns
- `references/severity-and-codes.md` - Shared severity scale and finding codes (used by the whole QA quartet)