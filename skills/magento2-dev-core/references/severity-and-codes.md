# Severity Scale & Finding Codes

Shared by `magento2-code-review`, `magento2-linter`, `magento2-security-scan`,
and `magento2-performance-audit`. A finding gets ONE severity level and, where
it fits an existing category below, ONE stable code — map to an existing code
before minting a new one; a new code is only for a genuinely new category,
not a rewording of an existing row.

## Severity scale

| Level | Meaning |
|---|---|
| Critical | Security/data-loss risk, or breaks testability/DI at a level that blocks a release |
| High | Anti-pattern or performance threat with real production impact — fix before release |
| Medium | Best-practice violation with limited blast radius — fix next sprint |
| Low | Style/structural preference, no functional risk — backlog |

## `M2-ARCH-xxx` — architecture anti-patterns (`magento2-dev-core`)

| Code | Anti-pattern | Severity | Why |
|---|---|---|---|
| M2-ARCH-001 | `ObjectManager::getInstance()` outside factories/proxies/bootstrap | Critical | Breaks testability, hides dependencies, escapes DI interception |
| M2-ARCH-002 | `<preference>` on a core class | High | Replaces the class entirely, blocks other extensions, upgrade-fragile |
| M2-ARCH-003 | Plugin on `Sales\Model\Order`, `Quote`, `Checkout`, `Payment`, `Customer\Model\Session` | High | High-traffic core classes — re-verify after every Magento upgrade |
| M2-ARCH-004 | Raw SQL outside a ResourceModel | Medium | Bypasses events, plugins, indexers, caching |
| M2-ARCH-005 | Copy-pasted theme template override | Medium | Silently breaks when Magento changes the original on upgrade — prefer layout XML/view models |
| M2-ARCH-006 | Extending `Action`, `AbstractModel`, `Template` base classes | Low | Prefer result interfaces, repositories, view models |
| M2-ARCH-007 | Multiple `around` plugins (or unordered plugins) on the same method with no explicit `sortOrder` | High | Undefined interception order — see `magento2-code-review`'s plugin/observer conflict check |

## `M2-SEC-xxx` — security findings (`magento2-security-scan`, and `magento2-linter`'s custom pattern greps)

| Code | Finding | Severity |
|---|---|---|
| M2-SEC-001 | SQL Injection (direct SQL with user input) | Critical |
| M2-SEC-002 | XSS, stored (unescaped database content in output) | Critical |
| M2-SEC-003 | XSS, reflected (unescaped user input in output) | High |
| M2-SEC-004 | Command injection (system command execution with user input) | Critical |
| M2-SEC-005 | `ObjectManager::getInstance()` used as a service locator | Critical |
| M2-SEC-006 | `$_GET`/`$_POST`/`$_REQUEST` superglobal access | High |
| M2-SEC-007 | `eval()` / dynamic code execution | Critical |
| M2-SEC-008 | `base64_decode()` on user input (obfuscation) | High |
| M2-SEC-009 | `file_get_contents()` on user-controlled input (path traversal) | High |
| M2-SEC-010 | Missing/incorrect CSP configuration (payment pages, PCI-DSS 4.0) | Critical |
| M2-SEC-011 | Missing form-key / CSRF protection | High |

`magento2-linter`'s "Security Pattern Detection" table and `magento2-security-scan`'s
vulnerability categories both feed this same namespace — a pattern that
appears in both (e.g. `ObjectManager::getInstance()`, raw SQL) is the same
code in either report, not two different ones.

## `M2-PERF-xxx` — performance findings (`magento2-performance-audit`)

| Code | Finding | Severity |
|---|---|---|
| M2-PERF-001 | N+1 query pattern | High |
| M2-PERF-002 | Heavy/eager constructor (service loaded on every request regardless of use) | Medium |
| M2-PERF-003 | Cache invalidation broader/more frequent than Magento's default targeted invalidation | High |
| M2-PERF-004 | Customer Data / `sections.xml` reload storm | Medium |
| M2-PERF-005 | Slow query surfaced by Slow Query Analysis (`EXPLAIN`-confirmed) | High |
| M2-PERF-006 | Core Web Vitals regression (LCP/INP/CLS past threshold) | Medium |

## `M2-THEME-xxx` — theme-only findings with no home in the above (`magento2-code-review`, theme scope)

| Code | Finding | Severity |
|---|---|---|
| M2-THEME-001 | Tailwind compiled CSS size regression vs. baseline / unused-class bloat | Medium |
| M2-THEME-002 | Excessive Alpine `x-data` hydration roots for a single page | Medium |
| M2-THEME-003 | RequireJS bundle size / unbundled-module count regression, or LESS output-size regression (Luma) | Medium |

CSP and Core Web Vitals findings found *during a theme-scope review* still use
`M2-SEC-010` and `M2-PERF-006` respectively — `M2-THEME-xxx` is reserved for
checks that have no equivalent anywhere else in this list.
