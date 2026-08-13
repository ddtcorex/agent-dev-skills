# Architecture Patterns Reference

This document covers Magento 2 architectural patterns and when to use each.

## Service Contracts

### Interface Location

```
Vendor/Module/
├── Api/
│   ├── ProductRepositoryInterface.php    # Data operations
│   ├── ProductManagementInterface.php     # Business logic
│   └── Data/
│       └── ProductInterface.php          # Data entity
├── Model/
│   ├── ProductRepository.php              # Implements Interface
│   └── Product.php                        # Implements Data Interface
```

### Repository Pattern

```php
// Api/Data/ProductInterface.php
namespace Vendor\Module\Api\Data;

interface ProductInterface
{
    public function getId(): int;
    public function setId(int $id): self;
    public function getName(): string;
    public function setName(string $name): self;
}

// Api/ProductRepositoryInterface.php
namespace Vendor\Module\Api;

use Vendor\Module\Api\Data\ProductInterface;
use Magento\Framework\Api\SearchCriteriaInterface;

interface ProductRepositoryInterface
{
    public function save(ProductInterface $product): ProductInterface;
    public function getById(int $id): ProductInterface;
    public function get(SearchCriteriaInterface $searchCriteria): \Magento\Framework\Api\SearchResultsInterface;
    public function delete(ProductInterface $product): bool;
    public function deleteById(int $id): bool;
}
```

### When NOT to Use Repository

Repositories are for CRUD operations. For complex business logic, create dedicated service classes:

```php
// WRONG - Don't put business logic in Repository
class ProductRepository implements ProductRepositoryInterface
{
    public function save(ProductInterface $product): ProductInterface
    {
        // Business logic here is OK for minimal transforms
        $product->setUpdatedAt(date('Y-m-d H:i:s'));
        // BUT complex logic should be elsewhere
    }
}

// CORRECT - Separate concerns
class ProductManagement implements ProductManagementInterface
{
    public function __construct(
        private readonly ProductRepositoryInterface $productRepository,
        private readonly StockManagerInterface $stockManager,
        private readonly PriceCurrencyInterface $priceCurrency
    ) {}

    public function activateWithStock(int $productId, float $stock): ProductInterface
    {
        $product = $this->productRepository->getById($productId);
        $this->stockManager->setStock($product, $stock);
        $product->setStatus(Status::STATUS_ENABLED);
        return $this->productRepository->save($product);
    }
}
```

## Plugins (Interceptors)

### Before Plugin

```php
// Modify arguments before method execution
public function beforeSetName(
    ProductInterface $subject,
    string $name
): array {
    // Transform or validate input
    $name = trim($name);
    if (strlen($name) < 3) {
        throw new \InvalidArgumentException('Name too short');
    }
    return [$name];
}
```

### After Plugin

```php
// Modify return value after method execution
public function afterGetName(
    ProductRepositoryInterface $subject,
    string $result,
    ProductInterface $product
): string {
    if ($product->getStatus() === Status::STATUS_DISABLED) {
        return '(Disabled) ' . $result;
    }
    return $result;
}
```

### Around Plugin (Use Sparingly)

```php
// Block original method and provide alternative
public function aroundExecute(
    SaveProductCommand $subject,
    callable $proceed,
    int $productId
): void {
    // If certain condition, skip original
    if ($this->featureFlag->isEnabled('skip_save')) {
        $this->logSkip($productId);
        return;
    }
    // Otherwise, call original
    $proceed($productId);
}
```

## Observers vs Plugins

| Aspect | Observer | Plugin |
|--------|----------|--------|
| Trigger | Event dispatch | Method interception |
| Order | By area/priority | DI sortOrder |
| Performance | Slower (event dispatch) | Faster (direct) |
| External Systems | **Best for** | Avoid for |
| Modify Arguments | No | Yes (before) |
| Modify Return | No | Yes (after) |

### When to Use Observer

- External integrations (email, webhook, sync)
- Logging and analytics
- Cross-module communication via events

### When to Use Plugin

- Modifying behavior of core methods
- Argument/return transformation
- Conditional logic within same module

```xml
<!-- etc/di.xml -->
<type name="Magento\Catalog\Model\Product">
    <plugin name="vendor_product_plugin" type="Vendor\Module\Plugin\ProductPlugin" sortOrder="10"/>
</type>
```

## XML Config Merging: Per-File vs. Merged Schema

Many Magento config readers (`Magento\Framework\Config\Reader\Filesystem` plus a
`SchemaLocatorInterface` implementation) validate in two passes with two different
schemas: each individual file is checked against a lenient **per-file schema**
(`getPerFileSchema()`), then the fully merged config across all modules is checked
against a stricter **merged schema** (`getSchema()`). Attributes the merged schema
marks `use="required"` are often optional in the per-file one, precisely because a
single module's file is expected to extend/override a declaration another module
already provided in full — not redeclare it from scratch.

`Magento\Widget\Model\Config\SchemaLocator` is a concrete example: it points
`getSchema()` at `widget.xsd` (`class` attribute required) but `getPerFileSchema()`
at a separate `widget_file.xsd` (`class` optional — only `id` is required). A
`<widget id="some_id">` with no `class` in one module's `widget.xml` is completely
valid on its own if another module's `widget.xml` already declares that same `id`
with a `class` — the merge fills it in.

**Before flagging a missing "required" XML attribute as something that will break
validation**, check whether the config type in question actually has this
two-schema split (grep the relevant `*/Model/Config/SchemaLocator.php` for
`getPerFileSchema()`), and validate the *single file* against the *per-file* schema,
not the merged one — `xmllint --noout --schema <per_file_schema> <file>` after
resolving the schema's `xs:include`d dependencies, or read the per-file schema
directly if `xmllint` can't resolve Magento's `urn:magento:...` include locations.
Don't assume a required-looking attribute is missing-and-broken without checking
which of the two schemas actually applies to a lone file.

## Factory vs Proxy

### Factory

```php
public function __construct(
    private readonly ProductFactory $productFactory
) {}

public function createProduct(): ProductInterface
{
    return $this->productFactory->create();
}
```

### Proxy (For Heavy Dependencies)

```php
// Use Proxy when dependency is expensive and not always used
public function __construct(
    private readonly HeavyServiceProxy $heavyService
) {}

// The Proxy only instantiates HeavyService when actually called
```

## Context Object Pattern

Instead of injecting many dependencies, use a context object:

```php
// ViewModel with context
class ProductViewModel implements \Magento\Framework\View\Element\Block\ArgumentInterface
{
    public function __construct(
        private readonly \Magento\Catalog\Api\ProductRepositoryInterface $productRepository,
        private readonly \Magento\Framework\Pricing\Helper\Data $priceHelper,
        private readonly \Magento\Framework\Serialize\Serializer\Json $json
    ) {}
}
```

## Command Pattern for Complex Operations

```php
// For complex, reusable operations
interface CommandInterface
{
    public function execute(mixed ...$args): mixed;
}

class ExpensiveCalculationCommand implements CommandInterface
{
    public function __construct(
        private readonly ExpensiveService $service
    ) {}

    public function execute(int $input): int
    {
        return $this->service->calculate($input);
    }
}

// Usage with cache
class CachedCalculationCommand implements CommandInterface
{
    public function __construct(
        private readonly ExpensiveCalculationCommand $command,
        private readonly CacheManager $cache
    ) {}

    public function execute(int $input): int
    {
        $cacheKey = 'calc_' . $input;
        if ($cached = $this->cache->get($cacheKey)) {
            return $cached;
        }
        $result = $this->command->execute($input);
        $this->cache->set($cacheKey, $result, 3600);
        return $result;
    }
}
```