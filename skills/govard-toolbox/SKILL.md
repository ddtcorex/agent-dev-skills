---
name: govard-toolbox
description: |
  This skill should be used when the user asks to "start/stop environment", "govard up",
  "govard down", "run commands in container", "govard sh", "do database operations", "db dump",
  "db import", "sync with remote", "bootstrap from staging", "debug configuration", or "set up
  Xdebug". Provides high-level shortcuts and references for the Govard development environment
  orchestrator. This is the BASE skill — for framework-specific shortcuts, also load
  govard-magento or govard-laravel.
compatibility: claude, codex, opencode, copilot
metadata:
  audience: developers
  workflow: general
---

# Govard Toolbox

Govard is a containerized development environment orchestrator. This skill provides high-level shortcuts and references.

## Quick Reference

### Environment Lifecycle

| Shortcut | Full Command | Purpose |
|----------|--------------|---------|
| `govard up` | `govard env up` | Start project |
| `govard down` | `govard env down` | Stop project |
| `govard sh` | `govard shell` | Interactive shell |
| `govard ps` | `govard env ps` | List containers |

### Common Commands

```bash
# Start environment
govard up

# Stop environment
govard down

# Stop with volumes (clean slate)
govard down -v

# Shell into PHP container
govard sh

# Run single command
govard sh -c "ls -la"

# View logs
govard logs -f

# Restart services
govard restart
```

### Database Operations

```bash
# Connect to MySQL
govard db connect

# Run query -- table names may need a framework-specific prefix (e.g. Magento's
# db.table_prefix in app/etc/env.php, WordPress's $table_prefix) if one is configured
govard db query "SELECT * FROM admin_user LIMIT 1"

# Import dump
govard db import --file backup.sql --drop

# Export database
govard db dump --no-noise -e staging

# Direct sync from remote
govard db import --stream-db -e staging --drop
```

### Remote Sync

```bash
# Add remote
govard remote add staging ssh://user@staging.server/path

# Test connection
govard remote test staging

# Sync everything
govard sync --source staging --full

# Plan before sync (preview)
govard sync --source staging --full --plan

# Skip noise (cache, logs)
govard sync --source staging --full --no-noise --no-pii
```

### Bootstrap

```bash
# From staging (full setup)
govard bootstrap --clone -e staging --no-pii --no-noise --yes

# Preview plan
govard bootstrap --clone -e staging --plan
```

## Tool Execution

```bash
# Run framework CLI
govard tool magento cache:flush
govard tool magerun cache:clear
govard tool artisan migrate
govard tool drush cr

# Node tools
govard tool npm install
govard tool composer install
```

## Services

```bash
# Redis
govard redis flush
govard redis cli

# Varnish
govard varnish purge

# Open URLs
govard open app      # Main site
govard open admin    # Admin panel
govard open db       # PHPMyAdmin
govard open mail     # Mailhog
```

## Debugging

```bash
# Xdebug control
govard debug on
govard debug off
govard debug status

# Diagnostics
govard diag
govard diag --fix    # Auto-fix issues
```

### Connecting an IDE

Xdebug listens on port `9003`. `govard debug on` only enables the extension inside the container — the IDE side still needs to be configured to listen and map paths, or nothing will connect.

**VSCode** (`.vscode/launch.json`):
```json
{
    "name": "Listen for Govard Xdebug",
    "type": "php",
    "request": "launch",
    "port": 9003,
    "pathMappings": { "/var/www/html": "${workspaceFolder}" }
}
```

**PhpStorm**: Settings → PHP → Debug → set debug port to `9003`; Settings → PHP → Servers → add a server named to match the project, host `<project-domain>.test`, port `443`, debugger `Xdebug`, path mapping `/var/www/html` → project directory.

If it still doesn't connect: check `govard debug status`, confirm the `XDEBUG_SESSION` cookie matches `stack.xdebug_session` in `.govard.yml`, and confirm the IDE is actually listening on 9003 before triggering a request. Disable Xdebug (`govard debug off`) when not actively debugging — it slows down every request noticeably.

## Configuration

The `.govard.yml` at the project root defines the framework, PHP/Node/DB versions, services, and domain — it's committed to the repo, so **no `govard init` is needed** for an existing project. Config is layered (later overrides earlier), and only `.govard.yml` is writable via `govard config set`:

| File | Purpose |
|---|---|
| `.govard.yml` | Team-shared base config (committed) |
| `.govard.local.yml` (or `.govard/.govard.local.yml`) | Developer-local overrides (gitignored) |
| `.govard.<env>.yml` | Environment overrides, activated via `GOVARD_ENV=<env>` |

```yaml
project_name: myproject
framework: magento2          # magento2, laravel, symfony, wordpress, nextjs, …
framework_version: 2.4.7
domain: myproject.test
stack:
  php_version: "8.3"
  node_version: "20"
  db_version: "10.6"
  services:
    web_server: apache        # apache | nginx
    db: mariadb               # mariadb | mysql | none
    search: opensearch        # opensearch | elasticsearch | none
    cache: redis              # redis | valkey | none
  features:
    xdebug: false
    varnish: false
```

```bash
# Auto-config after DB sync (rebuilds app-level config, e.g. Magento's env.php)
govard config auto

# Read a value without opening the file
govard config get stack.php_version

# Write a value — only .govard.yml is writable this way
govard config set stack.php_version 8.4
```

## Detailed References

See bundled documents:
- [COMMANDS.md](COMMANDS.md) - Exhaustive command reference
- [GUIDES.md](GUIDES.md) - Case studies and patterns
- [FAQ.md](FAQ.md) - Troubleshooting

For Magento-specific: Load `govard-magento` skill
For Laravel-specific: Load `govard-laravel` skill