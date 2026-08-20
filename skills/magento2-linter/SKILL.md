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

## Govard-Native Lint Audit Is the Real Gate

`govard audit run --checks lint` is Govard's persistent, native lint gate for Magento 2 projects
and modules, and running it for real is a **required step before telling a user a branch is
"verified" or "ready to push" — not an optional nice-to-have**. A bare local `vendor/bin/phpcs`/
`phpstan` invocation (see "Scoping" below) is a fast pre-check to catch obvious problems early —
it is not proof the branch is clean, because it can diverge from the native toolchain run in
either direction (see "Local Bare-Tool Runs Can Diverge from the Native Toolchain" below). Never
substitute a bare-tool "0 errors" for a real `govard audit run`, and never present local-only
results as if they were the real gate having passed.

Work through the audit in this order:

1. **Resolve target.** `--mode` (`auto`, `project`, `module_in_project`, or `standalone`) picks
   what gets analyzed; `auto` (the default) classifies the current directory itself — no flag
   needed for the common case:
   - `project`: current directory is a Magento project root (`bin/magento` plus a Magento
     Composer requirement) with no enclosing module — the whole project is analyzed.
   - `module_in_project`: current directory is a module (`etc/module.xml`, or a Composer package
     of type `magento2-module`) inside a Magento project — only the module is analyzed, with the
     whole project mounted read only so its autoloader resolves correctly.
   - `standalone`: current directory is a module with no Magento project anywhere above it —
     only the module is analyzed, with its dependencies installed into a scratch worktree.
   `--mode project` / `--mode module_in_project` / `--mode standalone` all force that
   classification and fail outright when the directory doesn't support it — useful to catch a
   misresolved `auto` guess rather than silently linting the wrong scope.
2. **Run it:** `govard audit run --checks lint` (`lint` is already the default `--checks` value,
   so plain `govard audit run` is equivalent).
3. **For standalone iteration only**, optionally narrow the PHP matrix with `--php 8.1,8.4`.
   `--php` on `project`/`module_in_project` targets is only accepted when it repeats the
   project's own active `stack.php_version` — it can't widen or narrow those targets'
   single-version run.
4. **Treat these outcomes distinctly — none of them means "clean code" except the last:**
   - `unsupported_php` — the requested PHP version isn't valid for this target (see "PHP
     versions" below); no container ran.
   - `infra_error` — a pull/build/Docker/dependency-resolution/report-schema failure. The run
     never produced a real lint result; never present this as "no findings." For a `standalone`
     target, a dependency-resolution failure while pulling a private Git/Composer dependency is a
     common cause — see "Standalone Composer Packages Need Isolated Verification" below for the
     `--allow-lint-ssh-agent` remedy.
   - `cancelled` — the run was stopped before completing; not a pass.
   - lint findings — PHPCS/PHPStan findings on an otherwise-completed run. This is the actual
     signal to act on.
   Only a completed run with zero findings is a clean result.
5. **If the team has configured an external provider** (`audit.lint.external_providers` in the
   project config), run it explicitly as an *additional* policy gate, not a substitute for the
   native run: `govard audit run --lint-provider team-ci` — `team-ci` here is just an example
   name; `--lint-provider` takes the provider's name directly, and that name and its definition
   come entirely from the project's own config (there's no bundled vendor-specific provider, and
   no separate flag for it). An external provider is never inferred and never a fallback for the
   native backend: an unknown `--lint-provider` name is an error, and a native failure stays a
   native failure. A `standalone` target has no project configuration to source
   `audit.lint.external_providers` from, so `govard` is the only provider available there.
6. **Never describe a host-project approximation as standalone matrix proof.** Running bare
   `vendor/bin/phpcs`/`phpstan` against a module nested inside a large host project is a fast
   local pre-check, not evidence of what an isolated `standalone` matrix run would find — the
   host project's own `vendor/`/`generated/` can hide or fabricate results in either direction
   (see the isolation notes under "Standalone Composer Packages" below). If the module qualifies
   as `standalone`, `govard audit run` is the authoritative check; fall back to a manual isolated
   install only when Govard itself isn't available.

**No diff or file-list scoping.** The native audit's finest granularity is a whole module
(`module_in_project`) or the whole project (`project`) — there is no file-list or changed-lines
argument, so a file list resolved for a PR/MR review does not flow into `govard audit run`.
`govard audit diff --base <ref>` (equivalently `run --scope diff --base <ref>`) records that base
ref in the session manifest, but lint still analyzes the full target today — result evidence
reports `effective_scope: project` regardless of the base ref given. Don't expect either form to
narrow analysis to just the diff; treat every native run's findings as covering the whole
module/project and split diff-introduced from pre-existing findings yourself afterward (see
`magento2-code-review`'s scope-modes reference for that split).

### PHP versions

The lint image provides `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, and `8.5`.

- **`project` and `module_in_project`** analyze exactly one version — the project's active
  `stack.php_version` — and accept any of the seven. The run is refused outright when a running
  application container reports a different PHP than the configuration does.
- **`standalone`** accepts `8.1` through `8.5` and defaults to all five; `7.4` and `8.0` are
  **not** available there and are rejected (`unsupported_php`) before any image is pulled,
  built, or run.

PHP 8.0 is real, supported analysis input for `project`/`module_in_project` targets — not a
stub — but the toolchain has **two independent version splits**, not one:

- **PHPStan / `bitexpert/phpstan-magento`:** `8.0` alone pins an older major (PHPStan `^1.12`,
  `bitexpert/phpstan-magento` `^0.19`) than the other six versions (PHPStan `^2.2`,
  `bitexpert/phpstan-magento` `^0.43`).
- **PHPCS / `magento/magento-coding-standard`:** `7.4` and `8.0` both pin `^4.0`, while `8.1`
  through `8.5` pin `^40.0` — a *different* split that groups `8.0` with `7.4` instead of against
  it.

Because the two axes disagree on where the line falls, no PHP version's findings are safely
comparable to any other's across both tools at once. Treat every PHP version's run as its own
baseline: don't compare rule IDs or findings across different PHP versions at all, for either
tool.

### Caching, rerun identity, and read-only source

- **Cache:** reusable analyzer state lives under `~/.govard/cache/audit/lint/<target-id>/`, keyed
  per toolchain identity (image, runner, PHP matrix, analyzer policy). Changing
  `composer.json`/`composer.lock`/`phpcs.xml`/`phpstan.neon` (or their `.dist` variants) discards
  the cached analyzer state but keeps the Composer download cache warm — a lock change doesn't
  force a full dependency re-download. `--no-lint-result-cache` forces a fresh analyzer pass for
  one run (reported back as cache state `bypassed`) without discarding the Composer download
  cache. `audit cleanup --older-than <duration>` prunes old *sessions*, never this cache.
- **Rerun identity:** every run is recorded under an explicit `<session-id>/runs/<run-id>/`.
  `govard audit rerun`, `status`, and `result` all require the exact `--session` value returned
  by the original run (`result` also needs `--run`) — Govard never guesses "the latest session,"
  so a rerun is always traceable to the run it's re-checking, not a fresh unrelated one.
- **Read-only source:** the source tree is always mounted read only into the lint container — a
  lint run cannot modify the code it analyzes. Auto-fix, if wanted, is still the separate bare
  `phpcbf` route (see "Auto-fix Capabilities" below).

## Prerequisites

Ensure the project has required tools:

```bash
# PHPCS (Magento Coding Standard)
composer require --dev magento/magento-coding-standard --no-interaction

# PHPStan (Magento extension)
composer require --dev bitexpert/phpstan-magento --no-interaction
```

**If `phpcs --standard=Magento2` errors with "Referenced sniff ... does not
exist" or "the Magento2 coding standard is not installed"**, don't
immediately conclude the dependency is missing from the project. Check
first whether it's already resolved in `composer.lock` but just not
registered with phpcs:

```bash
vendor/bin/phpcs -i   # lists registered standards — is Magento2 there?
composer show magento/magento-coding-standard 2>&1   # resolved in the lock file?
```

If the package IS in `composer.lock` (common cause: `magento-coding-standard`
registers phpcs's `installed_paths` via a Composer plugin/post-install
script, and that script simply never ran in this container/environment), a
plain `composer install` fixes it — it re-runs the package scripts without
touching the lock file. Seeing `Nothing to install, update or remove` is the
expected, safe outcome; it's still worth then re-running `vendor/bin/phpcs
-i` to confirm `Magento2` now appears before assuming the fix worked. Only
report the ruleset as genuinely unavailable (an environment gap worth
surfacing in a review's Coverage note) if it's absent from `composer.lock`
entirely or `composer install` doesn't fix the registration.

**The same "try `composer install` before concluding coverage is blocked"
check applies to PHPStan when a reviewed diff adds a new `composer.json`
require.** A PHPStan run against a class that extends an unresolved
dependency reports every single method on it as undefined — `Class X
extends unknown class Y`, then every inherited call cascades into `Call to
an undefined method`. That looks identical whether the package genuinely
needs live private-repo credentials to resolve, or is already sitting in
`composer.lock`/the local Composer cache from a prior `composer install`
elsewhere in the same environment (dependencies get cached by version, not
by branch). Don't assume the latter requires network access you don't have
— run `composer install` first and see what actually happens:

```bash
composer install --no-interaction   # uses the existing lock file, doesn't re-resolve
vendor/bin/phpstan analyse app/code/Vendor/Module -c phpstan.neon --memory-limit=1G
```

If it installs from cache with no prompt, re-run PHPStan — the "every
method undefined" noise for that dependency should disappear, and whatever
errors remain are real. Only report "PHPStan couldn't run, new dependency
not installed" in a review's Coverage note if `composer install` actually
fails or prompts for credentials you don't have.

## Local Bare-Tool Runs Can Diverge from the Native Toolchain

`govard audit run`'s native toolchain image always includes Magento-aware PHPStan extensions
(`bitexpert/phpstan-magento` — the same package this skill's own Prerequisites section has you
install for local runs). A bare local `vendor/bin/phpcs`/`vendor/bin/phpstan` invocation that
skips those extensions doesn't see the same errors the native toolchain does, so don't assume a
bare-tool run matches what `govard audit run` (or any CI pipeline built on it) actually enforces.

**On one real audit**, `phpstan.neon` had inline `@phpstan-ignore` comments. A bare local
`vendor/bin/phpstan` run (no extensions installed) reported them as "unmatched" — looking stale,
since nothing in that run triggered the errors they were suppressing — and they got deleted as
cleanup. The project's real lint gate installed `bitexpert/phpstan-magento` — a Magento-aware
PHPStan extension that resolves magic getters/setters and factory return types that vanilla
PHPStan can't see. With the extension active, those exact lines fired again as real errors; the
"cleanup" had silently reopened them. Two habits prevent this:

1. **Don't trust a bare local run's silence on `@phpstan-ignore` comments.** If a bare
   `vendor/bin/phpstan` run reports one as "unmatched," that's as likely to mean "this tool
   invocation is missing an extension the real gate uses" as "this suppression is genuinely
   stale" — confirm against `govard audit run` (or the project's actual CI wrapper, if one still
   exists) before deleting it.
2. **Install the same PHPStan extensions the native toolchain does** (`phpstan/extension-installer`
   plus `bitexpert/phpstan-magento`, per this skill's Prerequisites) before deciding an
   `@phpstan-ignore` comment is stale or a finding is a false positive. A bare install without
   Magento-aware extensions reports far more "undefined method" noise than the native toolchain
   ever sees, AND can hide real findings that only surface once those extensions are active —
   verify both ways before touching an ignore list.

> **New findings that share an error message with an already-tolerated pattern still need their
> own check — don't dismiss a whole batch by shape alone.** On one real fix, several new findings
> got bucketed with older, already-accepted ones as "same pattern, not worth fixing." The real
> gate disagreed: only one of the *dismissed* findings actually failed it, and none of the old
> ones it was grouped with did. Verify each new finding against what the real gate reports, not
> against how similar its wording looks to already-tolerated noise.

## Standalone Composer Packages Need Isolated Verification

If the module under test is a standalone Composer package (own `composer.json`, developed as its
own git repo, installed into a host project's `vendor/<vendor>/<package>`), `govard audit run`
from inside that package's own directory (with no Magento project anywhere above it) resolves
`standalone` mode automatically and installs its dependencies into a scratch worktree for you —
this is the native, authoritative way to get isolated results, and it's what "Never describe a
host-project approximation as standalone matrix proof" above is telling you to prefer. The manual
isolation procedure below is a fallback for when Govard itself isn't available, not the default
path.

- **Private Composer dependencies need `--allow-lint-ssh-agent`.** If the package requires a
  private Git/Composer dependency, the scratch-worktree install needs the host's SSH agent to
  fetch it: pass `--allow-lint-ssh-agent` (forwards `SSH_AUTH_SOCK` into the lint container). This
  is opt-in per run and never forwarded automatically — without it, expect the install to fail
  with `infra_error` rather than a clean or a findings result.

Running phpcs/phpstan against the package *nested inside* a large host project's
`vendor/<vendor>/<package>` (bypassing `govard audit run` entirely) can give misleading results in
both directions:
- PHPStan may resolve the host project's own `generated/code/` factory classes and report a
  narrower set of errors than the package's own CI ever sees, because a standalone package
  install has no `generated/` directory at all (no `bin/magento` context to generate one).
- Conversely it may fail to resolve classes the package's own dependency tree would otherwise
  provide, because the host project's autoloader silently takes precedence.

If `govard audit run` genuinely isn't available, install the module **in isolation** by hand
instead: copy it (excluding `.git`, `vendor`, `composer.lock`) into a scratch directory, run
`composer install --no-dev` there against its own `composer.json`, and run phpcs/phpstan against
that isolated copy instead of (or in addition to) the nested `vendor/` path. This reproduces
what `govard audit run --mode standalone` already automates, and it's the only manual way to
catch host-project-only false negatives/positives before they surface in the real gate.

> **`cd` into the scratch directory before invoking phpstan — isolating the `vendor/` being
> analysed isn't enough on its own.** PHPStan auto-detects `vendor/autoload.php` relative to the
> *current working directory*, not relative to wherever `-c`/`--configuration` points. On one
> real check, phpstan was invoked as `php <tools>/vendor/bin/phpstan analyse -c
> <scratch>/phpstan.neon <scratch>` from the *host* project's directory — it silently picked up
> the host's own `vendor/autoload.php` (which had `phpunit/phpunit` installed for the host's own
> test suite) instead of the scratch copy's. The isolated check reported 0 errors; the real
> isolated run, executed directly, reported 121 — every test class extending PHPUnit's
> `TestCase` had cascaded into "undefined method" findings once the *actual* isolated autoloader
> (with no PHPUnit available) was in play. Always `cd` into the scratch directory first, then
> invoke phpcs/phpstan from there — don't just point `-c`/a target path at it from elsewhere.

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

## In-Project `app/code/` Modules: Native `module_in_project` Scoping

The isolation advice above is for **standalone Composer packages** (own
`composer.json`, own git repo). An in-project `app/code/Vendor/Module` is
the opposite case — it has no `composer.json` of its own and depends on the
*whole host project's* `vendor/` to resolve Magento framework classes.

`govard audit run`, run from inside the module directory, resolves
`module_in_project` mode automatically: it analyzes only that module, with
the whole project mounted read only alongside it so the module's autoloader
resolves against the real project `vendor/` — no rsync'd full-project copy,
no synthetic `composer.json`, no external wrapper needed. This is the
native, module-scoped equivalent of what a CI wrapper's `--path=` flag might
look like it should do; prefer it over any manual scoping workaround.

For an in-project `app/code/Vendor/Module`, pick based on what's actually needed:

- **Module-scoped, native (the authoritative check for a PR/MR review)**:
  run `govard audit run` from inside `app/code/Vendor/Module` — see the
  workflow at the top of this doc. Not scoped to a diff either: it analyzes
  the whole module and surfaces every pre-existing finding in it, not just
  what the PR/MR introduced. Split diff-introduced findings from
  pre-existing ones (`magento2-code-review`'s scope-modes reference covers
  how) before treating this as a PR-only gate.
- **Module-scoped, using the project's own installed tools (fast local
  pre-check only — see "Local Bare-Tool Runs Can Diverge from the Native
  Toolchain" above)**: run the bare binaries directly, from the project
  root, with the module's path as the *target argument* — see "Scoping"
  below (`vendor/bin/phpcs --standard=Magento2 app/code/Vendor/Module`,
  `vendor/bin/phpstan analyse app/code/Vendor/Module -c phpstan.neon`). This
  uses the exact tool versions this project's own `composer.lock` already
  pins, but without the Magento-aware PHPStan extensions or per-PHP-version
  isolation the native toolchain provides. **Never `cd` into the module
  directory first and expect either tool to find the project's own
  `vendor/autoload.php` from there** — invoke them from the project root,
  same autoloader hazard as the standalone-isolation case above.
- **Full-project audit**: run `govard audit run` from the project root —
  `auto` resolves to `project` mode there and analyzes the whole tree in one
  pass, surfacing every pre-existing repo-wide finding alongside whatever
  the new module introduces, not scoped to a diff. Only worth it for a
  genuine full-project audit, not a quick per-module check.

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

**`Call to an undefined method Vendor\Class::setFoo()`/`getFoo()` is a
common false positive**, not just noise from missing extensions in
general — specifically, almost every Magento Block/Model class extends
`Magento\Framework\DataObject` (directly or via `AbstractBlock`/
`AbstractModel`), which implements a magic `__call()` covering arbitrary
`get*`/`set*`/`has*`/`unset*` accessors backed by an internal data array.
`bitexpert/phpstan-magento` teaches PHPStan about this; without it, every
such call reports as undefined, real or not. Before accepting *or*
rejecting one of these findings, look for a **working precedent of the
exact same method name on the exact same class (or a sibling that clearly
shares the pattern) elsewhere in the codebase** — a genuinely-working
`$obj->setRows($x)` / `$obj->getRows()` pair used successfully by other
callers of the same class is strong evidence it's a real (if PHPStan-blind)
magic accessor, not a defect. Conversely, a method call with no such
precedent anywhere in the class's actual ancestor chain — especially one
copied from a *different, unrelated sibling class* that happens to define
its own same-named real method — is worth escalating rather than dismissing
as "probably just PHPStan noise." On one real review, `Renderer::setRows()`
turned out to be the legitimate magic-accessor pattern (the vendor's own
`Rows.php`/`MultiService.php` call it identically, and its own
`.phtml` template consumes it via `getRows()`), while a sibling class's
`$this->getLinkUrl($url)` call — no such method existed anywhere in *that*
class's ancestor chain, only on unrelated sibling widget classes that each
define their own — was a real, previously-undetected bug: it silently fell
through to the magic getter and always returned an empty URL instead of
throwing, making it easy to miss without checking the ancestor chain
directly.

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

The examples below wire the bare tools directly into a pipeline — useful if a project doesn't
run Govard at all. Where Govard is available, `govard audit run --checks lint` (see
"Govard-Native Lint Audit Is the Real Gate" above) is the native equivalent and includes the
Magento-aware PHPStan extensions and per-PHP-version isolation these bare invocations don't.

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