---
name: magento2-backend-dev
description: |
  This skill should be used when the user asks to "create an API endpoint", "build a REST API",
  "add a GraphQL resolver", "create a CLI command", "add a cron job", "set up a message queue",
  "implement a web API", "add a SOAP service", or "create a data provider". Covers Magento 2
  backend development: REST/SOAP/GraphQL APIs, CLI commands, and cron jobs. DEPENDENT on
  magento2-dev-core for security and architecture patterns.
compatibility: claude, codex, opencode, copilot
depends: [magento2-dev-core]
metadata:
  audience: backend developers
  workflow: magento
---

# Magento 2 Backend Developer

This skill covers API development (REST, SOAP, GraphQL), CLI commands, cron jobs, and message queues.

## Related Skills

**REQUIRED BACKGROUND:** Load `magento2-dev-core` first — it defines the DI, repository, and security patterns (constructor injection, service contracts, escaping, discouraged functions) this skill assumes without repeating.

Pairs with `magento2-security-scan` when the API/resolver you're building touches authentication, ACL, or user input, and with `magento2-performance-audit` for queue/consumer and N+1 concerns once the endpoint is built. In a Govard environment, use `govard-magento` for the CLI/container side (`bin/magento`, cache, indexers).

## REST API

### Service Contract Structure

```
Vendor/Module/
├── Api/
│   ├── ProductRepositoryInterface.php    # Declaration
│   └── Data/
│       └── ProductInterface.php          # Data entity
└── Model/
    └── ProductRepository.php              # Implementation
```

### Data Interface

```php
<?php
declare(strict_types=1);

namespace Vendor\Module\Api\Data;

use Magento\Framework\Api\ExtensibleDataInterface;

/**
 * Product entity interface
 */
interface ProductInterface extends ExtensibleDataInterface
{
    const ENTITY_ID = 'entity_id';
    const NAME = 'name';
    const SKU = 'sku';
    const PRICE = 'price';

    /**
     * @return int|null
     */
    public function getId(): ?int;

    /**
     * @param int $id
     * @return self
     */
    public function setId(int $id): self;

    /**
     * @return string
     */
    public function getName(): string;

    /**
     * @param string $name
     * @return self
     */
    public function setName(string $name): self;

    // ... other getters/setters
}
```

**PHPDoc is not optional here**: the REST serializer reads `@param`/`@return`/`@throws` PHPDoc on `Api/` interfaces via reflection to build the request/response schema — a type hint alone is not enough for the WebAPI framework to expose the field correctly.

### Repository Implementation

```php
<?php
declare(strict_types=1);

namespace Vendor\Module\Model;

use Vendor\Module\Api\Data\ProductInterface;
use Vendor\Module\Api\Data\ProductSearchResultsInterface;
use Vendor\Module\Api\ProductRepositoryInterface;
use Vendor\Module\Model\ResourceModel\Product as ProductResource;
use Magento\Framework\Api\SearchCriteriaInterface;
use Magento\Framework\Api\SearchResultsInterfaceFactory;

class ProductRepository implements ProductRepositoryInterface
{
    public function __construct(
        private readonly ProductFactory $productFactory,
        private readonly ProductResource $resource,
        private readonly ProductInterface $data,
        private readonly SearchResultsInterfaceFactory $searchResultsFactory
    ) {}

    public function save(ProductInterface $product): ProductInterface
    {
        $this->resource->save($product);
        return $product;
    }

    public function getById(int $id): ProductInterface
    {
        $product = $this->productFactory->create();
        $this->resource->load($product, $id);
        if (!$product->getId()) {
            throw new \Magento\Framework\Exception\NoSuchEntityException(
                __('Product with ID %1 does not exist', $id)
            );
        }
        return $product;
    }

    public function get(SearchCriteriaInterface $searchCriteria): ProductSearchResultsInterface
    {
        $searchResults = $this->searchResultsFactory->create();
        $searchResults->setSearchCriteria($searchCriteria);
        $collection = $this->productCollection->create();
        $this->applySearchCriteria($collection, $searchCriteria);
        $searchResults->setItems($collection->getItems());
        $searchResults->setTotalCount($collection->getSize());
        return $searchResults;
    }
}
```

### WebAPI Configuration

```xml
<!-- etc/webapi.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<routes xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="urn:magento:module:Magento_Webapi:etc/webapi.xsd">
    <!-- Route for single resource -->
    <route method="GET" url="/V1/vendor/product/:id">
        <service class="Vendor\Module\Api\ProductRepositoryInterface" method="getById"/>
        <resources>
            <resource ref="Vendor_Module::product_read"/>
        </resources>
    </route>

    <!-- Route for collection -->
    <route method="GET" url="/V1/vendor/products">
        <service class="Vendor\Module\Api\ProductRepositoryInterface" method="getList"/>
        <resources>
            <resource ref="Vendor_Module::product_read"/>
        </resources>
    </route>

    <!-- Route for create/update -->
    <route method="POST" url="/V1/vendor/product">
        <service class="Vendor\Module\Api\ProductRepositoryInterface" method="save"/>
        <resources>
            <resource ref="Vendor_Module::product_write"/>
        </resources>
    </route>
</routes>
```

### ACL Configuration

```xml
<!-- etc/acl.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="urn:magento:framework:etc/acl.xsd">
    <acl>
        <resources>
            <resource id="Magento_Backend::admin">
                <resource id="Vendor_Module::product" title="Product" sortOrder="10">
                    <resource id="Vendor_Module::product_read" title="Read Product" sortOrder="10"/>
                    <resource id="Vendor_Module::product_write" title="Write Product" sortOrder="20"/>
                    <resource id="Vendor_Module::product_delete" title="Delete Product" sortOrder="30"/>
                </resource>
            </resource>
        </resources>
    </acl>
</config>
```

## GraphQL

### Schema Definition

```graphql
# etc/schema.graphqls

type Query {
    products(filter: ProductFilterInput, pageSize: Int = 20, currentPage: Int = 1): Products
    @doc(description: "Get products list")
    @resolver(class: "Vendor\\Module\\Model\\Resolver\\ProductList")
    @cache(cacheable: false)
}

type Mutation {
    createProduct(input: ProductInput!): Product
    @doc(description: "Create a new product")
    @resolver(class: "Vendor\\Module\\Model\\Resolver\\CreateProduct")
    @cache(cacheable: false)
}

input ProductFilterInput {
    entity_id: FilterTypeInput
    name: FilterTypeInput
    sku: FilterTypeInput
    price: FilterTypeInput
}

type Product {
    entity_id: Int
    name: String
    sku: String
    price: Float
}

input ProductInput {
    name: String!
    sku: String!
    price: Float!
}
```

### Resolver Implementation

```php
<?php
declare(strict_types=1);

namespace Vendor\Module\Model\Resolver;

use Magento\Framework\GraphQl\Config\Element\Field;
use Magento\Framework\GraphQl\Exception\GraphQlInputException;
use Magento\Framework\GraphQl\Query\ResolverInterface;
use Magento\Framework\GraphQl\Schema\Type\ResolveInfo;

class ProductList implements ResolverInterface
{
    public function __construct(
        private readonly ProductRepositoryInterface $productRepository,
        private readonly SearchCriteriaBuilder $searchCriteriaBuilder,
        private readonly FilterGroupBuilder $filterGroupBuilder
    ) {}

    public function resolve(Field $field, $context, ResolveInfo $info, array $value = null, array $args = null)
    {
        if (!isset($args['pageSize'])) {
            $args['pageSize'] = 20;
        }

        $searchCriteria = $this->searchCriteriaBuilder
            ->setPageSize($args['pageSize'])
            ->setCurrentPage($args['currentPage'] ?? 1)
            ->create();

        $searchResults = $this->productRepository->get($searchCriteria);

        return [
            'total_count' => $searchResults->getTotalCount(),
            'items' => $this->convertProducts($searchResults->getItems())
        ];
    }

    private function convertProducts(array $products): array
    {
        return array_map(function ($product) {
            return [
                'entity_id' => $product->getId(),
                'name' => $product->getName(),
                'sku' => $product->getSku(),
                'price' => $product->getPrice()
            ];
        }, $products);
    }
}
```

For cacheable GraphQL types, implement `IdentityInterface` on the resolver (or a dedicated identity provider) so Magento can tag the response for full-page cache invalidation — without it, `@cache(cacheable: true)` has nothing to key on and the type is effectively never cached correctly.

## CLI Commands

### Command Class

```php
<?php
declare(strict_types=1);

namespace Vendor\Module\Console\Command;

use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

class SyncProductsCommand extends Command
{
    protected $commandName = 'vendor:products:sync';
    protected $commandDescription = 'Synchronize products from external source';

    public function __construct(
        private readonly ProductRepositoryInterface $productRepository,
        private readonly ExternalApiClient $apiClient
    ) {
        parent::__construct($this->commandName);
    }

    protected function configure(): void
    {
        $this->setDescription($this->commandDescription);
        $this->addOption(
            'dry-run',
            'd',
            InputOption::VALUE_NONE,
            'Run without making changes'
        );
        $this->addOption(
            'limit',
            'l',
            InputOption::VALUE_REQUIRED,
            'Limit number of products',
            100
        );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $io->title('Product Synchronization');

        $limit = (int) $input->getOption('limit');
        $dryRun = $input->getOption('dry-run');

        if ($dryRun) {
            $io->note('Running in dry-run mode');
        }

        try {
            $externalProducts = $this->apiClient->fetchProducts($limit);
            $io->progressStart(count($externalProducts));

            foreach ($externalProducts as $externalProduct) {
                if (!$dryRun) {
                    $this->syncProduct($externalProduct);
                }
                $io->progressAdvance();
            }

            $io->progressFinish();
            $io->success(sprintf('Synchronized %d products', count($externalProducts)));

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $io->error('Synchronization failed: ' . $e->getMessage());
            return Command::FAILURE;
        }
    }
}
```

### Register Command

```xml
<!-- etc/di.xml -->
<type name="Magento\Framework\Console\CommandList">
    <arguments>
        <argument name="commands" xsi:type="array">
            <item name="vendor_products_sync"
                  xsi:type="object">Vendor\Module\Console\Command\SyncProductsCommand</item>
        </argument>
    </arguments>
</type>

<!-- Or use attribute (Magento 2.3+) -->
<!-- Vendor/Module/Console/Command/SyncCommand.php -->
<?php
declare(strict_types=1);

namespace Vendor\Module\Console\Command;

use Symfony\Component\Console\Attribute\AsCommand;

#[AsCommand(
    name: 'vendor:products:sync',
    description: 'Synchronize products',
)]
class SyncCommand extends Command
{
    // ...
}
```

If the command touches store-scoped config, catalog, or anything area-aware, set the area code explicitly before use: `$this->state->setAreaCode(Area::AREA_ADMINHTML)` (or `AREA_FRONTEND`/`AREA_GLOBAL`) — a bare CLI command defaults to no area, and area-dependent services throw a `LocalizedException` otherwise.

## Cron Jobs

### Cron Class

```php
<?php
declare(strict_types=1);

namespace Vendor\Module\Cron;

use Vendor\Module\Api\ProductRepositoryInterface;
use Psr\Log\LoggerInterface;

class CleanupExpired
{
    public function __construct(
        private readonly ProductRepositoryInterface $productRepository,
        private readonly LoggerInterface $logger
    ) {}

    public function execute(): void
    {
        $this->logger->info('Running expired product cleanup');

        try {
            $expiredProducts = $this->findExpiredProducts();
            foreach ($expiredProducts as $product) {
                $product->setStatus(Status::STATUS_DISABLED);
                $this->productRepository->save($product);
            }

            $this->logger->info(sprintf('Cleaned up %d expired products', count($expiredProducts)));
        } catch (\Exception $e) {
            $this->logger->error('Cleanup failed: ' . $e->getMessage());
        }
    }
}
```

### Cron Configuration

```xml
<!-- etc/crontab.xml -->
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="urn:magento:module:Magento_Cron:etc/crontab.xsd">
    <group id="default">
        <job name="vendor_module_cleanup" instance="Vendor\Module\Cron\CleanupExpired" method="execute">
            <schedule>0 2 * * *</schedule>
        </job>
    </group>
    <group id="index">
        <job name="vendor_module_reindex" instance="Vendor\Module\Cron\Reindex" method="execute">
            <schedule>*/5 * * * *</schedule>
        </job>
    </group>
</config>
```

### Cron Groups (for large scale)

```xml
<!-- etc/cron_groups.xml -->
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="urn:magento:framework:Cron/etc/cron_groups.xsd">
    <group id="custom">
        <schedule_generate_every>1</schedule_generate_every>
        <schedule_ahead_for>4</schedule_ahead_for>
        <schedule_lifetime>2</schedule_lifetime>
        <history_cleanup_every>10</history_cleanup_every>
        <history_failure_lifetime>1440</history_failure_lifetime>
        <history_success_lifetime>60</history_success_lifetime>
        <use_separate_process>1</use_separate_process>
    </group>
</config>
```

## Message Queue

Not every project needs all four queue XML files — `communication.xml` (topic schema) is the one that's always required. Add `queue_topology.xml`, `queue_publisher.xml`, `queue_consumer.xml` only for what the use case actually needs (e.g. just `queue_publisher.xml` when publishing to a queue a third party already owns).

### Publisher Configuration

```xml
<!-- etc/queue.xml -->
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="urn:magento:module:Magento_MessageQueue:etc/queue.xsd">
    <publisher topic="vendor.product.updated">
        <connection name="db"/>
    </publisher>
</config>
```

### Queue Consumer

```php
<?php
declare(strict_types=1);

namespace Vendor\Module\Model\Consumer;

use Vendor\Module\Api\Data\ProductUpdateInterface;
use Magento\Framework\MessageQueue\ConsumerInterface;
use Magento\Framework\MessageQueue\QueueInterface;

class ProductUpdateConsumer implements ConsumerInterface
{
    public function __construct(
        private readonly ProductUpdateHandler $handler
    ) {}

    public function process(string $message): void
    {
        /** @var ProductUpdateInterface $data */
        $data = json_decode($message, true);
        $this->handler->process($data);
    }
}
```

### Message Class

```php
<?php
declare(strict_types=1);

namespace Vendor\Module\Api\Data;

interface ProductUpdateInterface
{
    public function getProductId(): int;
    public function setProductId(int $id): self;
    public function getAction(): string;
    public function setAction(string $action): self;
    public function getTimestamp(): \DateTimeInterface;
    public function setTimestamp(\DateTimeInterface $timestamp): self;
}
```

### Consumer Registration

```xml
<!-- etc/queue.xml -->
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <consumer name="vendor.product.update.consumer"
              queue="vendor_product_update"
              connection="db"
              consumer="Vendor\Module\Model\Consumer\ProductUpdateConsumer"/>
</config>
```

## Pitfalls recap

- The `resource ref` in `webapi.xml` must match an actual `id` declared in `acl.xml` — a typo here fails silently with a 403, not a config error.
- Always throw `NoSuchEntityException` (not return `null`) when a repository can't find an entity — the WebAPI framework maps it to a proper 404.
- A configured consumer (`queue.xml`) does nothing on its own — it must actually be running as a process via cron or a supervisor (`bin/magento queue:consumers:start`), or messages just pile up in the `queue_message` tables. See `magento2-performance-audit`.
- GraphQL resolvers get no automatic ACL check — validate the customer/admin context explicitly inside `resolve()` if the field exposes anything sensitive.

`cron_schedule` rows move through `pending` → `running` → `success`/`error`/`missed`. Never `TRUNCATE cron_schedule` to "fix" a stuck cron — query it (`WHERE status IN ('error','missed')`) to diagnose the actual cause instead, since truncating destroys the run history you'd need to find it.

## Verification

```bash
# Test CLI command
bin/magento vendor:products:sync --dry-run --limit=10

# List registered commands
bin/magento list | grep vendor

# Run cron manually
bin/magento cron:run --group=custom

# Check queue consumers
bin/magento queue:consumers:list

# Start message queue consumer
bin/magento queue:consumers:start vendor.product.update.consumer

# Test REST API
curl -X GET "http://localhost/V1/vendor/product/1" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json"

# Clear API cache
bin/magento cache:clean config
```