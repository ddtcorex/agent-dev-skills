---
name: magento2-hyva-dev
description: |
  This skill should be used when the user asks to "create a Hyvä theme", "set up a child
  theme", "build an Alpine.js component", "make this CSP-compliant", "add Tailwind CSS
  classes", "convert Luma to Hyvä", "migrate Knockout to Alpine", work on "Hyvä checkout" or
  "Hyvä React components", or handle "Tailwind configuration" or "CSP nonce registration".
  Provides expert Hyvä theme development for Magento 2. This is a SPECIALIZED skill for
  Hyvä-specific patterns. DEPENDENT on magento2-dev-core for PHP/backend patterns.
compatibility: claude, codex, opencode, copilot
depends: [magento2-dev-core]
metadata:
  audience: frontend developers
  workflow: magento
  references:
    - https://github.com/hyva-themes/hyva-ai-tools
    - https://docs.hyva.io/
---

# Magento 2 Hyvä Developer

Hyvä is a modern Magento 2 frontend framework with dramatically simplified JavaScript and CSS. This skill covers Hyvä-specific patterns.

## Related Skills

**REQUIRED BACKGROUND:** Load `magento2-dev-core` first — it defines the PHP/backend patterns (DI, escaping, repositories) this skill assumes for any ViewModel or backend code behind a Hyvä template.

Hyvä and Luma (`magento2-frontend-dev`) are mutually exclusive theme stacks — check the theme's `theme.xml` parent (`Hyva/default`/`Hyva/reset` vs `Magento/blank`) and `composer.json` for `hyva-themes/*` packages before assuming either applies. Pair with `govard-magento` for the container/CLI side.

## Detect the project's actual setup first

Hyvä/Tailwind conventions vary a lot by project age — check before applying a pattern:

- **Tailwind version**: v4 uses CSS-based config and `hyva.config.json` design tokens; v2/v3 use `tailwind.config.js`. Check `web/tailwind/package.json`.
- **CSP build**: `Hyva/default-csp` vs the plain `Hyva/default`/`Hyva/reset` parent in `theme.xml`. Applying CSP-only nonce patterns to a non-CSP theme (or vice versa) wastes effort.
- **Parent theme**: `Hyva/reset` (built from scratch) vs `Hyva/default` (full starter) changes how much markup/CSS already exists to extend rather than rewrite.

## Hyvä vs Luma Comparison

| Aspect | Luma | Hyvä |
|--------|------|------|
| JavaScript | ~200 resources (RequireJS/Knockout) | 2 resources (Alpine.js) |
| CSS | LESS-based | Tailwind CSS |
| Bundle Size | 500KB+ | <50KB |
| Core Web Vitals | Challenging | Optimized |
| Learning Curve | Steep | Gentle |
| Maintenance | Complex | Simple |

## Theme Structure

### Creating a Child Theme

Always copy `web/` from the parent theme rather than creating it from scratch — it carries the Tailwind config and build tooling the theme needs:

```bash
mkdir -p app/design/frontend/<Vendor>/<Theme>/web
cp -r vendor/hyva-themes/magento2-default-theme/web/* app/design/frontend/<Vendor>/<Theme>/web/
# For a CSP theme, copy from magento2-default-theme-csp instead
```

Then add `registration.php`, `theme.xml` (parent: `Hyva/default`, `Hyva/reset`, or `Hyva/default-csp`), and `composer.json`, install Tailwind deps and build, then `bin/magento setup:upgrade && bin/magento cache:flush` to pick up the new theme.

```
app/design/frontend/Vendor/Theme/
├── registration.php
├── theme.xml
├── composer.json
├── package.json
├── tailwind.config.js
├── package.json
├── web/
│   ├── tailwind/
│   │   ├── base/           # Preflight, resets
│   │   ├── components/     # Reusable components
│   │   │   ├── buttons.css
│   │   │   ├── forms.css
│   │   │   └── messages.css
│   │   ├── utilities/     # Custom utilities
│   │   └── theme/         # Page-specific
│   └── js/
│       └── alpinejs/      # Alpine components
├── layout/
│   └── default.xml
└── templates/
    └── ...
```

## CSP (Content Security Policy) Compliance

### Critical: PCI-DSS 4.0 (Required since April 2025)

Payment pages MUST NOT use:
- `unsafe-eval` CSP directive
- `unsafe-inline` CSP directive

### CSP Nonce Registration

**Every inline script MUST register with CSP:**

```php
<?php
/** @var Hyva\Theme\ViewModel\HyvaCsp $hyvaCsp */
use Hyva\Theme\ViewModel\HyvaCsp;
?>

<!-- Register script before using nonce -->
<?php $hyvaCsp->registerInlineScript() ?>
<script nonce="<?= $cspNonce ?>">
    // CSP-compliant code
</script>
```

### CSP-Compatible Alpine.js Patterns

**WRONG (CSP violations):**
```html
<!-- These patterns break CSP -->
<button @click="count++">Add</button>
<span x-show="!loading">Ready</span>
<input :value="name" @input="name = $event.target.value">
```

**CORRECT (CSP-compliant):**
```html
<!-- Use methods for mutations -->
<button @click="increment">Add</button>
<span x-show="isNotLoading">Ready</span>
<input :value="name" @input="updateName">
```

```javascript
function initComponent() {
    return {
        count: 0,
        loading: true,
        name: '',

        increment() {
            this.count++;
        },

        isNotLoading() {
            return !this.loading;
        },

        updateName(event) {
            this.name = event.target.value;
        }
    }
}
window.addEventListener('alpine:init', () => {
    Alpine.data('initComponent', initComponent);
}, {once: true})
```

### Registering Alpine Components

```php
<?php
/** @var Hyva\Theme\ViewModel\HyvaCsp $hyvaCsp */
?>

<script>
function initProductSlider() {
    return {
        products: [],
        currentIndex: 0,

        init() {
            // Initialization
        },

        next() {
            this.currentIndex = (this.currentIndex + 1) % this.products.length;
        },

        prev() {
            this.currentIndex = (this.currentIndex - 1 + this.products.length) % this.products.length;
        }
    }
}
window.addEventListener('alpine:init', () => Alpine.data('initProductSlider', initProductSlider), {once: true})
</script>
<?php $hyvaCsp->registerInlineScript() ?>
```

## Alpine.js Component Structure

### Basic Component

```javascript
// web/js/alpinejs/Example.js
function initExample() {
    return {
        // Observable state
        isOpen: false,
        items: [],
        selectedId: null,

        // Computed (reactive)
        get hasItems() {
            return this.items.length > 0;
        },

        // Methods
        toggle() {
            this.isOpen = !this.isOpen;
        },

        select(id) {
            this.selectedId = id;
        },

        // Lifecycle
        init() {
            // Called when component initializes
            this.loadData();
        },

        loadData() {
            fetch('/api/data')
                .then(res => res.json())
                .then(data => this.items = data);
        }
    }
}
window.addEventListener('alpine:init', () => Alpine.data('initExample', initExample), {once: true})
```

### Template Usage

```html
<div x-data="initExample">
    <button @click="toggle">Toggle</button>

    <div x-show="isOpen">
        <template x-for="item in items" :key="item.id">
            <div @click="select(item.id)" :class="{ 'selected': selectedId === item.id }">
                <span x-text="item.name"></span>
            </div>
        </template>
    </div>
</div>

<script>
    function initExample() {
        // ... component logic
    }
    window.addEventListener('alpine:init', () => Alpine.data('initExample', initExample), {once: true})
</script>
<?php $hyvaCsp->registerInlineScript() ?>
```

### Passing Data from PHP

```php
<?php
/** @var \Magento\Framework\Escaper $escaper */
/** @var \Hyva\Theme\ViewModel\HyvaCsp $hyvaCsp */
$productsJson = json_encode($products, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
?>

<div x-data="initProductList"
     data-products="<?= $escaper->escapeHtmlAttr($productsJson) ?>">
</div>

<script>
function initProductList() {
    return {
        products: [],

        init() {
            this.products = JSON.parse(this.$root.dataset.products || '[]');
        }
    }
}
window.addEventListener('alpine:init', () => Alpine.data('initProductList', initProductList), {once: true})
</script>
<?php $hyvaCsp->registerInlineScript() ?>
```

## Hyvä Utilities

Hyvä provides global utilities via the `hyva` object:

### Form Handling
```javascript
// Get form key
hyva.getFormKey()

// Submit form via POST
hyva.postForm({
    action: '/checkout',
    data: { product_id: 123, qty: 1 }
})

// Alternative with fetch
async function submitForm(url, data) {
    const formKey = hyva.getFormKey();
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ ...data, form_key: formKey })
    });
    return response.json();
}
```

### Cookies
```javascript
hyva.getCookie('customer_segment')
hyva.setCookie('recent_viewed', productId, 30)
```

### Formatting
```javascript
hyva.formatPrice(price, showSign)
hyva.str('Hello {0}', name)
hyva.safeParseNumber(value)
```

### DOM Manipulation
```javascript
hyva.replaceDomElement('#target', '<span>New content</span>')
hyva.trapFocus(modalElement)
```

### Events
```javascript
// After Alpine initialization
hyva.alpineInitialized(function() {
    console.log('Alpine ready');
})
```

## View Models

Prefer view models (`Hyva\Theme\Model\ViewModelInterface` / Magento's `ArgumentInterface`) over blocks for passing data to templates — they keep PHP logic out of the theme directory (which should hold only templates, layout, `i18n`, and `web/` assets) and in a proper `app/code` module where Magento's DI can autoload the class.

```php
// app/code/Vendor/Module/ViewModel/ProductInfo.php
declare(strict_types=1);

namespace Vendor\Module\ViewModel;

use Hyva\Theme\Model\ViewModelInterface;
use Magento\Framework\View\LayoutInterface;

class ProductInfo implements ViewModelInterface
{
    public function __construct(
        private readonly LayoutInterface $layout
    ) {}

    public function isInStock(): bool
    {
        $product = $this->layout->getBlock('product.info')->getProduct();
        return $product && $product->isInStock();
    }
}
```

```xml
<!-- layout/default.xml -->
<referenceBlock name="product.info">
    <arguments>
        <argument name="product_info_view_model" xsi:type="object">Vendor\Module\ViewModel\ProductInfo</argument>
    </arguments>
</referenceBlock>
```

```php
<?php /** @var \Vendor\Module\ViewModel\ProductInfo $productInfoViewModel */ ?>
<?php if ($productInfoViewModel->isInStock()): ?>
    <button class="btn-cart">Add to Cart</button>
<?php endif; ?>
```

## Tailwind CSS

### Tailwind v4 (CSS-based config)

Newer Hyvä themes use Tailwind v4, which drops `tailwind.config.js` for a CSS-based config plus a `hyva.config.json` design-token file — check `web/tailwind/package.json` first, the two configs are not interchangeable.

```css
/* web/tailwind/tailwind-source.css */
@import "tailwindcss";

@theme {
    --color-primary: oklch(46% 0.2 265);
    --spacing-xs: 0.5rem;
}

@layer components {
    .btn-primary {
        @apply bg-primary text-white px-4 py-2 rounded;
    }
}
```

```json
// hyva.config.json
{
  "tokens": {
    "src": "hyva.design.tokens.json",
    "format": "default",
    "cssSelector": "@theme"
  }
}
```

Generate tokens/sources with `npx hyva-sources` / `npx hyva-tokens` rather than hand-rolling them.

### Directory Structure
```
web/tailwind/
├── base/
│   └── _styles.pcss         # Preflight, typography
├── components/
│   ├── _buttons.pcss
│   ├── _forms.pcss
│   └── _messages.pcss
├── utilities/
│   └── _custom-utilities.pcss
├── theme/
│   ├── _header.pcss
│   └── _footer.pcss
└── app.css                  # Main entry
```

### Build Commands
```bash
# Development with watch
npm run watch

# Production build
npm run build

# PurgeCSS config (auto-included)
# Tailwind automatically removes unused classes
```

### Common Classes

```html
<!-- Buttons -->
<button class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
    Add to Cart
</button>

<!-- Forms -->
<input type="text" 
       class="w-full border border-gray-300 rounded px-3 py-2 focus:border-blue-500 focus:outline-none">

<!-- Cards -->
<div class="bg-white rounded-lg shadow-md p-4">
    <!-- Content -->
</div>

<!-- Grid -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <!-- Items -->
</div>
```

### Responsive Design
```html
<!-- Mobile first -->
<div class="w-full md:w-1/2 lg:w-1/3">
    <!-- Shows 100% on mobile, 50% on tablet, 33% on desktop -->
</div>
```

## Layout XML

### Hyvä-Specific Handles

```xml
<!-- Add Hyvä modal support -->
<update handle="hyva_modal"/>

<!-- Register custom Alpine component -->
<head>
    <script src="Hyva_Theme::js/alpinejs/my-component.js"/>
</head>
```

### Override Template
```xml
<referenceBlock name="product.info" template="MyCompany_MyTheme::product/view.phtml"/>
```

## Migration from Luma

### Step 1: Analyze Dependencies
```bash
# List jQuery dependencies
grep -r "require.*jquery" app/design/frontend/Vendor/Theme/web/js/

# Check Knockout bindings
grep -r "data-bind=" app/design/frontend/Vendor/Theme/templates/
```

### Step 2: Replace JavaScript
```javascript
// Luma Knockout
define(['ko'], function(ko) {
    return {
        items: ko.observableArray([]),
        addItem: function(item) {
            this.items.push(item);
        }
    };
});

// Hyvä Alpine
function initComponent() {
    return {
        items: [],
        addItem(item) {
            this.items.push(item);
        }
    }
}
```

### Step 3: Replace LESS with Tailwind
```less
// Luma LESS
.product-card {
    .lib-card();
    .lib-respond-to(@mobile, { width: 100%; });
}

// Hyvä Tailwind
<div class="bg-white rounded-lg shadow-md p-4 w-full md:w-1/2">
```

### Step 4: Update Templates
```php
// Luma (Knockout)
<span data-bind="text: product.name"></span>

// Hyvä (Alpine)
<span x-text="product.name"></span>
```

## Third-Party Compatibility Modules

A Luma-built third-party extension needs a Hyvä compatibility module to override its templates and JS — check the vendor's GitHub for an existing one (many ship under `hyva-themes/*`) before writing your own.

To build one: create a module that requires the original module, copy only the `.phtml` templates you need to override, replace any jQuery/Knockout JS with CSP-compatible Alpine, and sequence it after both the original module and `Hyva_Theme` in `module.xml`. Then register it so Hyvä actually picks it up:

```xml
<!-- etc/frontend/di.xml -->
<type name="Hyva\CompatModuleFallback\Model\CompatModuleRegistry">
    <arguments>
        <argument name="compatModules" xsi:type="array">
            <item name="hyva_vendor_module" xsi:type="array">
                <item name="original_module" xsi:type="string">Vendor_Module</item>
                <item name="compat_module" xsi:type="string">Vendor_ModuleHyva</item>
            </item>
        </argument>
    </arguments>
</type>
```

Without this `CompatModuleRegistry` registration, Hyvä has no way to know the compat module should override the original's frontend output — the templates get copied but never actually take effect.

## Hyvä UI & CMS Components

- **UI components** (`hyva-themes/hyva-ui`): prebuilt, template-based components installed into a theme — copy `src/*` into the theme, merge any layout XML, and add config to `etc/view.xml`.
- **CMS components**: custom Hyvä CMS blocks live in a module depending on `Hyva_CmsBase`, declared in a `components.json` schema. Key gotchas: `children` is a root-level property (not a field type), validation lives under `attributes`, and the default-value key is `default_value`, not `default`.

## Responsive Images

Use `Hyva\Theme\ViewModel\Media::getResponsivePictureHtml()` to generate `<picture>` markup instead of hand-rolling `srcset`. Set `loading="eager" fetchpriority="high"` on the LCP image (hero/first product image) and `loading="lazy"` on everything below the fold — getting this backwards is a common, easy-to-miss LCP regression.

## Testing with Playwright

Hyvä pages scatter hidden `x-show` elements around the DOM — always scope message assertions to `#messages`, never a bare `.message.error` selector, or the test will match a hidden element and give a false pass/fail. Prefer `getByRole` / `getByLabel` / scoped `getByText` over raw CSS selectors, and use web-first assertions with a longer timeout to account for Alpine's reactive re-render delay after form submits.

## Official Hyvä AI Tools

Hyvä provides official AI skills for various assistants:

| Tool | Purpose | Install |
|------|---------|---------|
| hyva-alpine-component | CSP-compatible Alpine components | `.opencode/skills/` |
| hyva-child-theme | Theme creation | `.opencode/skills/` |
| hyva-cms-component | CMS blocks | `.opencode/skills/` |
| hyva-ui-component | UI component installation | `.opencode/skills/` |

```bash
# Install Hyvä AI tools
curl -fsSL https://raw.githubusercontent.com/hyva-themes/hyva-ai-tools/main/install.sh | sh -s opencode
```

## Verification

```bash
# Build CSS
cd web/tailwind && npm run build

# Clear cache
bin/magento cache:clean layout block_html full_page

# Static content deploy
bin/magento setup:static-content:deploy -f
```

### CSP Console Check

**Chrome DevTools MCP (preferred, if available):** navigate to the page,
then `list_console_messages` — filter for CSP violation reports
(`Content-Security-Policy` directive errors, "Refused to execute inline
script" / "Refused to load the stylesheet" messages). No manual browser
interaction needed; test with CSP headers enabled the same way.

**Manual fallback (no MCP connected):** open the page in a browser, check
the DevTools console for CSP errors, and confirm again with CSP headers
enabled.

## Pitfalls recap

- Hyvä replaces Luma entirely: no RequireJS, Knockout, UI-component JS, jQuery, or LESS in Hyvä templates.
- Every inline `<script>` needs `$hyvaCsp->registerInlineScript()`, or it silently fails under CSP.
- Prefer the CSP-safe Alpine pattern (named `Alpine.data()` functions, no inline expression logic like `@click="count++"`) even on a non-CSP build — it's the cleaner default and avoids a rewrite if the project later enables CSP.
- Rebuild Tailwind (`npm run build`) after any style change, or the new classes won't be in the compiled CSS.
- Always escape output in `.phtml` with `$escaper`, same as any other Magento template.