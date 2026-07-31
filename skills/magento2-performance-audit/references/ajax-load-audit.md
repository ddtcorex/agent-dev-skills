# Client-Side AJAX Request Load Audit

Full detail for Workflow step 6.

A page can pass every check above — `full_page` cache enabled, invalidation narrowly scoped — and still overload the backend, because `full_page` only caches the initial HTML response. Customer data (private content), GraphQL calls, and custom AJAX endpoints are session/customer-scoped, so they bypass FPC entirely and hit PHP-FPM/the database on **every single page view**, cached HTML or not. This matters more than it used to: modern crawlers (SEO bots, AI scrapers, headless-Chrome-based tools) execute JS the same way a real browser does, so every page they crawl re-fires the same AJAX calls a human visitor would — a site can look fully cached in every metric above and still fall over under crawl volume, because the part that's actually uncached is invisible to an HTML/query-count audit.

> **Confirm this project actually uses the sections.xml/Customer Data pattern before leaning on §2 below.** Some Magento builds replace it partly or fully with a different reactive layer — a Livewire-style library (e.g. Magewire), a PWA/headless frontend, or GraphQL-driven state — where cart/customer widgets update through a different mechanism entirely, and a wildcard-rule check on `sections.xml` won't surface much because there's barely any `sections.xml` usage to begin with. Quick check: `find app/code vendor -iname sections.xml | wc -l` and a grep for the reactive library's own component base class under `app/code`. If it's low/near-zero, rely on the network capture in §1 instead — look for that other mechanism's own request pattern using the same "same-origin, repeated, sets a new session cookie" signals used below.

## 1. Capture the AJAX footprint of a representative page

Do this for **each of the 3 page types** from the Per-Page-Type Audit (`references/per-page-type-audit.md`) — same rationale: the AJAX footprint differs by page type just as much as the query/profiler footprint does, and a homepage-only check can miss the worst offender entirely (a real audit found the homepage firing one same-origin call, while the product page on the same site fired six distinct same-origin endpoints — the two page types are not interchangeable samples).

Open Chrome DevTools > Network, filter to Fetch/XHR, and load the page **in incognito / with site data cleared** — this simulates what an anonymous visitor (or crawler) sees, not a footprint inflated or deflated by your own logged-in dev session.

> **Watch specifically for `/customer/section/load` with an empty `sections` parameter** (`?sections=`). Magento has a long-standing quirk where an empty `sections` filter returns **every** registered section rather than none — including the full cart, checkout eligibility, and the complete worldwide country/region directory used by address forms. What looks like the cheapest, most trivial call on the page can silently be the single most expensive uncached response it makes. Check the actual response body size/content, not just the request URL, before dismissing it.

- Count same-origin (your Magento domain) requests separately from third-party ones — only same-origin requests add load to your server; a Facebook/Google pixel call goes straight to their servers and isn't a Magento capacity concern (unless the project has a custom server-side tracking proxy — e.g. a controller relaying Conversion API/Measurement Protocol events — in which case treat that controller like any other custom AJAX endpoint below). In practice, on a real storefront this list is often dominated by third-party marketing tags (chat widgets, popups, review widgets, ad pixels) — don't let their volume distract from the (usually much smaller) same-origin count, which is the one that matters here.
- For each same-origin XHR/fetch, check its response headers — anything `Cache-Control: private`/`no-store` (Magento surfaces this as `X-Magento-Cache-Debug: MISS` / `X-Magento-Cache-Control: ..., no-store` on its own responses) is a call that hits the backend fresh every time, unlike the FPC-served HTML.
- Watch for the *same* same-origin endpoint firing more than once per page load, especially if each call sets a **new** `Set-Cookie: PHPSESSID=...` — that means each occurrence is opening its own PHP session server-side, doubling (or worse) the real backend cost of a single page view.

Common first-party culprits to look for: `/customer/section/load` (private content / Customer Data), `/graphql` (if any theme/PWA component fetches client-side), custom wishlist/compare/stock-check/price AJAX endpoints, any custom analytics/tracking proxy controller, and — easy to miss — **third-party marketing/personalization integrations (Connectif, Klaviyo, Nosto, etc.) that ship their own customer/cart-context controller** to sync cart/login state into their widget. These sit entirely outside `sections.xml`/Magento's private-content system, so auditing §2 below won't catch them — only the network capture in this step will.

## 2. Audit `sections.xml` for overly broad Customer Data invalidation

`sections.xml` declares which Customer Data sections must be invalidated (forcing a `/customer/section/load` reload) after specific controller actions. A wildcard or over-broad rule forces **every** unrelated action to reload the **full** section list, not just what actually changed — the most common cause of a `/customer/section/load` reload storm.

```xml
<!-- WRONG - "*" invalidates ALL sections on ANY controller action -->
<action name="*">
    <section name="cart"/>
    <section name="customer"/>
    <section name="wishlist"/>
    <section name="compare-products"/>
    <section name="review"/>
</action>

<!-- CORRECT - scope invalidation to only the sections that action actually affects -->
<action name="checkout_cart_add">
    <section name="cart"/>
</action>
<action name="wishlist_index_add">
    <section name="wishlist"/>
</action>
```

```bash
# Find wildcard/broad invalidation rules across custom and third-party modules
grep -rn '<action name="\*"' app/code vendor/*/module-*/etc/frontend/sections.xml 2>/dev/null
```

> Magento core itself ships one wildcard rule (`vendor/magento/module-theme/etc/frontend/sections.xml`, `<action name="*"><section name="messages"/></action>`) — that one is expected and cheap (a single lightweight section on every action). It's not the anti-pattern; the anti-pattern is a wildcard rule reloading several/heavy sections. When grepping, check what's actually declared inside each match before flagging it — don't flag on the wildcard alone.

Also check custom JS for widgets that force their own reload instead of relying on the invalidation-rule-driven one — this duplicates whatever `sections.xml` already triggers for the same user action:

```javascript
// WRONG - forces a reload of everything on every click, on top of whatever
// the sections.xml invalidation rule for this action already reloads
$('.some-widget').on('click', function () {
    customerData.reload(['cart', 'customer', 'wishlist'], true);
});

// CORRECT - let sections.xml own invalidation for rule-covered sections;
// only call reload() explicitly for a section with no matching action rule,
// and scope it to just that section
customerData.reload(['wishlist-widget-count'], false);
```
