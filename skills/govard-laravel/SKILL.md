---
name: govard-laravel
description: |
  This skill should be used when the user asks to "run migrations", "run artisan commands",
  "clear Laravel cache", "config:cache", "run queue operations", "schedule:run", "tinker into
  app", "artisan tinker", "run Laravel Pint", or "npm dev/prod". Provides Laravel-specific
  Govard shortcuts and commands. DEPENDENT on govard-toolbox for base commands.
compatibility: claude, codex, opencode, copilot
depends: [govard-toolbox]
metadata:
  audience: developers
  workflow: laravel
---

# Govard Laravel Commands

Laravel-specific shortcuts and commands for Govard environments.

## Related Skills

**REQUIRED BACKGROUND:** Load `govard-toolbox` first — this skill only covers Laravel-specific shortcuts layered on top of Govard's base environment commands (`govard up`, `govard sh`, `govard db`, remote sync, Xdebug setup).

## Artisan Commands

```bash
# Cache management
govard sh -c "govard tool artisan config:cache"
govard sh -c "govard tool artisan config:clear"
govard sh -c "govard tool artisan cache:clear"

# Route cache
govard sh -c "govard tool artisan route:cache"
govard sh -c "govard tool artisan route:clear"

# View cache
govard sh -c "govard tool artisan view:cache"
govard sh -c "govard tool artisan view:clear"
```

## Database

```bash
# Migrations
govard sh -c "govard tool artisan migrate"
govard sh -c "govard tool artisan migrate:fresh"
govard sh -c "govard tool artisan migrate:refresh"
govard sh -c "govard tool artisan migrate:rollback"
govard sh -c "govard tool artisan migrate:status"

# Seeders
govard sh -c "govard tool artisan db:seed"
govard sh -c "govard tool artisan db:seed --class=UserSeeder"

# Factory
govard sh -c "govard tool artisan make:factory PostFactory"
govard sh -c "govard tool artisan tinker"

# Direct SQL
govard db connect
```

## Queue Operations

```bash
# Start queue worker
govard sh -c "govard tool artisan queue:work"

# Queue withSupervisor
govard svc up

# Retry failed jobs
govard sh -c "govard tool artisan queue:retry all"
govard sh -c "govard tool artisan queue:failed"

# Clear queue
govard sh -c "govard tool artisan queue:flush"
```

## Scheduler

```bash
# Run scheduler (keep in cron)
govard sh -c "govard tool artisan schedule:run"

# List scheduled
govard sh -c "govard tool artisan schedule:list"
```

## Development

```bash
# Create commands
govard sh -c "govard tool artisan make:command MyCommand"
govard sh -c "govard tool artisan make:controller MyController"
govard sh -c "govard tool artisan make:model Post"
govard sh -c "govard tool artisan make:migration create_posts_table"

# Tinker (interactive REPL)
govard sh -c "govard tool artisan tinker"

# Show routes
govard sh -c "govard tool artisan route:list"
govard sh -c "govard tool artisan route:list --path=api"
```

## Testing

```bash
# Run tests
govard sh -c "govard tool artisan test"

# With PHPUnit
govard sh -c "govard tool php artisan test"
govard sh -c "vendor/bin/phpunit"

# Specific test
govard sh -c "vendor/bin/phpunit --filter=UserTest"
```

## Frontend Assets

```bash
# Node modules
govard tool npm install
govard tool npm run dev
govard tool npm run prod
govard tool npm run watch

# Laravel Mix (if using)
govard sh -c "npm run dev"
govard sh -c "npm run production"

# Clear Vite cache
govard sh -c "rm -rf node_modules/.vite"
```

## Logging

```bash
# View logs
govard sh -c "tail -f storage/logs/laravel.log"

# Clear logs
govard sh -c "govard tool artisan log:clear"

# Laravel Debugbar (if installed)
govard sh -c "curl -s http://local.test/_debugbar/open"
```

## Common Workflows

### After Pulling Code

```bash
govard tool composer install
govard sh -c "govard tool artisan migrate"
govard sh -c "govard tool artisan cache:clear"
govard sh -c "npm install && npm run dev"
```

### Creating Features

```bash
govard sh -c "govard tool artisan make:model Post -mcr"  # Model + Migration + Controller
govard sh -c "govard tool artisan migrate"
govard sh -c "govard tool artisan route:list"
```

### Deployment Prep

```bash
govard sh -c "govard tool artisan config:cache"
govard sh -c "govard tool artisan route:cache"
govard sh -c "govard tool artisan view:cache"
govard sh -c "npm run prod"
```