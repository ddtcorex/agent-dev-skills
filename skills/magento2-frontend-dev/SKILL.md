---
name: magento2-frontend-dev
description: |
  This skill should be used when the user asks to "create a Knockout.js component", "add a UI
  Component", "modify layout XML", "customize a template", "write LESS CSS", "style with the
  Magento UI library", "add a RequireJS module", "extend JavaScript", "customize checkout", or
  "modify the cart page". Covers Magento 2 frontend development using the Luma/Blank theme.
  DEPENDENT on magento2-dev-core for backend patterns and escaping.
compatibility: claude, codex, opencode, copilot
depends: [magento2-dev-core]
metadata:
  audience: frontend developers
  workflow: magento
---

# Magento 2 Frontend Developer

This skill covers Luma/Blank theme development, Knockout.js, RequireJS, LESS CSS, and UI Components.

## Related Skills

**REQUIRED BACKGROUND:** Load `magento2-dev-core` first — it defines the escaping (`escapeHtml`/`escapeHtmlAttr`/`escapeJs`) and backend patterns this skill's templates and view models rely on.

This skill targets Luma/Blank-derived themes. If the project's `theme.xml` parent is `Hyva/default` or `Hyva/reset` (or `composer.json` requires `hyva-themes/*`), use `magento2-hyva-dev` instead — the two frontend stacks are mutually exclusive and share almost no code patterns.

## Theme Structure

```
app/design/frontend/Vendor/Theme/
├── registration.php
├── theme.xml
├── composer.json
├── media/
│   └── preview.jpg
├── web/
│   ├── css/
│   │   └── source/
│   │       ├── _extend.less
│   │       ├── _theme.less
│   │       └── _variables.less
│   ├── js/
│   │   └── namespace/
│   │       └── module.js
│   └── images/
└── Magento_Theme/
    ├── layout/
    │   ├── default.xml
    │   └── default_head_blocks.xml
    └── templates/
        └── header.phtml
```

## RequireJS Modules

### Creating a Module

```javascript
// web/js/namespace/module.js
define([
    'jquery',
    'ko',
    'uiComponent',
    'Magento_Customer/js/customer-data'
], function ($, ko, Component, customerData) {
    'use strict';

    return Component.extend({
        defaults: {
            template: 'Namespace_Module/template-name',
            exports: {
                value: '${ $.provider }:data.value'
            },
            tracks: {
                value: true
            }
        },

        /** @inheritdoc */
        initialize: function () {
            this._super();
            // Initialization logic
        },

        /** @inheritdoc */
        initObservable: function () {
            this._super()
                .observe('value');
            return this;
        },

        /**
         * Example method
         * @returns {string}
         */
        getFormattedValue: function () {
            return this.value() + ' formatted';
        }
    });
});
```

### Using a Module in Template

```html
<!-- In .phtml -->
<script type="text/x-magento-init">
{
    "*": {
        "Namespace_Module/js/module": {
            "config": "value"
        }
    }
}
</script>

<!-- In Knockout template -->
<div data-bind="scope: 'module'">
    <span data-bind="text: value"></span>
    <button data-bind="click: doAction">Click</button>
</div>

<script type="text/x-magento-init">
{
    "*": {
        "Magento_Ui/js/core/app": {
            "components": {
                "module": {
                    "component": "Namespace_Module/js/module"
                }
            }
        }
    }
}
</script>
```

## Knockout.js Patterns

### ViewModel Structure

```javascript
define(['ko'], function () {
    'use strict';

    return function (config, element) {
        var self = this;

        // Observable properties
        self.products = ko.observableArray(config.products || []);
        self.isLoading = ko.observable(false);
        self.selectedId = ko.observable(null);

        // Computed properties
        self.hasProducts = ko.computed(function () {
            return self.products().length > 0;
        });

        self.selectedProduct = ko.computed(function () {
            return self.products().find(function (p) {
                return p.id === self.selectedId();
            });
        });

        // Methods
        self.selectProduct = function (product) {
            self.selectedId(product.id);
        };

        self.loadMore = function () {
            self.isLoading(true);
            // AJAX call
            $.get('/api/products', function (data) {
                self.products(self.products().concat(data));
                self.isLoading(false);
            });
        };

        // Initialize
        self.init = function () {
            if (config.enableAutoLoad) {
                self.loadMore();
            }
        }();
    };
});
```

### Knockout Template

```html
<!-- web/template/product/list.html -->
<!-- ko if: hasProducts() -->
<div class="product-list">
    <!-- ko foreach: products() -->
    <div class="product-item" data-bind="click: $parent.selectProduct">
        <img data-bind="attr: { src: image, alt: name }" />
        <span data-bind="text: name"></span>
        <span data-bind="text: price"></span>
    </div>
    <!-- /ko -->
</div>
<!-- /ko -->

<!-- ko ifnot: hasProducts() -->
<div class="no-products">No products available</div>
<!-- /ko -->

<button data-bind="enable: !isLoading(), click: loadMore">
    <!-- ko if: isLoading() -->Loading...<!-- /ko -->
    <!-- ko ifnot: isLoading() -->Load More<!-- /ko -->
</button>
```

## Layout XML

### Reference

```xml
<?xml version="1.0" encoding="UTF-8"?>
<page xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:noNamespaceSchemaLocation="urn:magento:framework:View/Layout/etc/page_configuration.xsd">
    <head>
        <!-- Add JS -->
        <script src="Vendor_Module::js/component.js"/>

        <!-- Add CSS -->
        <css src="Vendor_Module::css/styles.css"/>

        <!-- Add meta -->
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
    </head>
    <body>
        <!-- Move block -->
        <move element="product.info.main" destination="product.info.extra"/>

        <!-- Remove block -->
        <referenceBlock name="product.info.review" remove="true"/>

        <!-- Reference block -->
        <referenceBlock name="header.container">
            <container name="custom.container" as="customContainer" label="Custom Container" htmlTag="div" htmlClass="custom-class">
                <block class="Vendor\Module\Block\Custom" name="custom.block" template="Vendor_Module::custom.phtml"/>
            </container>
        </referenceBlock>

        <!-- Arguments -->
        <referenceBlock name="product.info.price">
            <arguments>
                <argument name="css_class" xsi:type="string">custom-price</argument>
            </arguments>
        </referenceBlock>
    </body>
</page>
```

### Adding JS with Layout

```xml
<page xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:noNamespaceSchemaLocation="urn:magento:framework:View/Layout/etc/page_configuration.xsd">
    <head>
        <!-- External JS -->
        <script src="https://example.com/external.js" src_type="url"/>

        <!-- Module JS with config -->
        <script src="Vendor_Module::js/tracker.js">
            <attributes name="defer"/>
        </script>
    </head>
</page>
```

## LESS CSS

### Structure

```less
// web/css/source/_extend.less
// Main entry point for theme customizations

// Import lib (Magento UI library)
@import 'lib/_lib.less';

// Import vendor styles
@import '_components.less';

// Your theme variables
@color-primary: #1979c3;
@color-secondary: #f0f0f0;

// Extend parent theme
@import '_theme.less';

// Custom styles
.block-product {
    margin-bottom: @indent__l;

    &__title {
        font-size: 20px;
        color: @color-primary;
    }

    &__image {
        width: 100%;
    }
}
```

### UI Library Mixins

```less
// Using Magento UI library mixins
.product-grid {
    .lib-css(display, flex);
    .lib-css(flex-wrap, wrap);
    .lib-css(gap, 20px);

    .lib-list-reset();
}

// Buttons
.action.primary {
    .lib-button-replace();
    .lib-button-primary();
}

// Forms
.field {
    .lib-form-field();
}

// Links
a {
    .lib-link($_linkColor: @color-primary);
}
```

### Responsive Breakpoints

```less
// Mobile first approach
@mobile: 640px;
@tablet: 768px;
@desktop: 1024px;

.product-card {
    width: 100%;

    @media (min-width: @tablet) {
        width: 50%;
    }

    @media (min-width: @desktop) {
        width: 33.333%;
    }
}
```

## UI Components (Magento 2.3+)

### Basic UI Component

```javascript
// web/js/view/checkout/summary/shipping-method.js
define([
    'uiComponent',
    'Magento_Checkout/js/model/quote',
    'Magento_Checkout/js/action/select-shipping-method'
], function (Component, quote, selectShippingMethodAction) {
    'use strict';

    return Component.extend({
        defaults: {
            template: 'Magento_Checkout/shipping-method/shipping-method-list'
        },

        isVisible: function () {
            return quote.shippingMethod() !== null;
        },

        /** Get shipping method code */
        getMethodCode: function () {
            var method = quote.shippingMethod();
            return method ? method.carrier_code + '_' + method.method_code : '';
        },

        /** Select this shipping method */
        selectMethod: function (method) {
            selectShippingMethodAction(method);
        }
    });
});
```

### XML UI Component Definition

```xml
<!-- etc/frontend/ui_components/sales_rule_form.xml -->
<form xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:noNamespaceSchemaLocation="urn:magento:module:Ui:etc/ui_configuration.xsd">
    <argument name="data" xsi:type="array">
        <item name="js_config" xsi:type="array">
            <item name="provider" xsi:type="string">sales_rule_form.sales_rule_form_data_source</item>
        </item>
        <item name="label" xsi:type="string" translate="true">Cart Price Rules</item>
        <item name="template" xsi:type="string">templates/form/collapsible</item>
    </argument>
    <settings>
        <buttons>
            <button name="save" class="Magento\SalesRule\Ui\Component\Listing\Column\RuleActions\Save"/>
        </buttons>
        <layout>
            <navContainerName>left</navContainerName>
            <type>tabs</type>
        </layout>
        <deps>
            <dep>sales_rule_form.sales_rule_form_data_source</dep>
        </deps>
    </settings>
    <dataSource name="sales_rule_form_data_source">
        <argument name="data" xsi:type="array">
            <item name="js_config" xsi:type="array">
                <item name="component" xsi:type="string">Magento_Ui/js/form/provider</item>
            </item>
        </argument>
        <settings>
            <submitUrl path="sales_rule.rule/save"/>
        </settings>
        <dataProvider name="sales_rule_form_data_source" class="Magento\SalesRule\Ui\Component\DataProvider"/>
    </dataSource>
</form>
```

## Cache Configuration

```xml
<!-- Layout cache -->
<referenceBlock name="product.info" cacheable="true" ttl="3600"/>

<!-- Disable cache for dynamic content -->
<referenceBlock name="dynamic.content">
    <arguments>
        <argument name="cache_lifetime" xsi:type="number">null</argument>
    </arguments>
</referenceBlock>
```

## Verification

```bash
# Deploy static content
bin/magento setup:static-content:deploy -f --theme=Vendor/Theme

# Clean caches
bin/magento cache:clean layout block_html

# Enable template hints (dev only)
bin/magento dev:template-hints:enable
bin/magento dev:template-hints:enable --store=admin

# Check RequireJS config
bin/magento config:set dev/js/merge_files 0
```

## Pitfalls recap

- Don't mix Knockout/UI Component patterns into a Hyvä theme (or vice versa) — check `theme.xml` first if unsure which stack the project uses.
- A `referenceBlock` marked `cacheable="false"` blocks full-page caching for the whole containing page, not just that block — use `esi:inline` or a shorter `cache_lifetime` instead where possible.
- Clear the right cache after a change: `layout`/`block_html` for layout XML, `full_page` for FPC-visible content, and always redeploy static content (`setup:static-content:deploy`) after CSS/JS changes in production mode.
- RequireJS module paths are case-sensitive and must match the `require-config.js` map exactly, or the module silently fails to resolve.