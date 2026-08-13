# AI Development Skills Hub

An extensible hub of AI development skills, packaged as a plugin for both
Claude Code and Codex CLI -- currently Magento 2 (architecture, linting,
performance, security) and Govard dev-environment orchestration for Magento
and Laravel, with more tech stacks added over time.

Every skill follows the open [Agent Skills standard](https://agentskills.io) (a
`SKILL.md` file with `name`/`description` frontmatter), which Claude Code,
OpenCode, Codex CLI, and GitHub Copilot all understand — see
[Installation](#-installation) for how to wire this repo's `skills/` folder into
each one, since they don't all scan the same directory name.

---

## 📂 Directory Structure

Every skill lives under `skills/<name>/SKILL.md` — this is the layout both
Claude Code's and Codex CLI's plugin loaders require, and it's the single
source of truth (no other copy exists anywhere else in the repo).

```
dev-skills-hub/
├── README.md                        # This file (Global documentation and guide)
├── .claude-plugin/
│   ├── plugin.json                  # Claude Code plugin manifest
│   └── marketplace.json             # Self-listing marketplace (source: "./")
├── .codex-plugin/
│   └── plugin.json                  # Codex CLI plugin manifest (points at the same skills/)
├── .agents/
│   └── plugins/
│       └── marketplace.json         # Self-listing marketplace for Codex (source: local "./")
│
└── skills/
    ├── 📦 CORE STANDARDS & ARCHITECTURES (Foundation patterns)
    │   └── magento2-dev-core/           # Magento 2 core guidelines (DI, Repositories, Security)
    │
    ├── 🛠️ QUALITY ASSURANCE & AUDITING (Linting and static analysis)
    │   ├── magento2-linter/             # PHPCS, PHPStan, PHPMD code quality checks
    │   ├── magento2-performance-audit/  # Web vitals, infrastructure and DB profiling
    │   ├── magento2-security-scan/      # Static vulnerability code scanning
    │   └── magento2-code-review/        # PR/module/theme/project review orchestration
    │
    ├── 🎨 FRONTEND & BACKEND FRAMEWORKS (Domain-specific code)
    │   ├── magento2-hyva-dev/           # Alpine.js, Tailwind CSS, CSP payment pages
    │   ├── magento2-frontend-dev/       # Luma Knockout.js, LESS, RequireJS
    │   └── magento2-backend-dev/        # REST, GraphQL resolvers, Cron, Queues
    │
    └── 🔧 DEV ENVIRONMENT & CLI TOOLS (Toolchain orchestration)
        ├── govard-toolbox/              # Base container orchestrator toolbox
        ├── govard-magento/              # Magento-specific dev env commands
        └── govard-laravel/              # Laravel-specific dev env commands
```

---

## ⚡ Extension Guide: Adding New Skills

You can easily expand this hub with any new programming language, framework, or utility domain (e.g., React, Python, Docker, CI/CD, AWS, etc.).

### Step 1: Create the Skill Folder
Create `skills/[domain]-[tool/stack]-[purpose]/` using kebab-case
(e.g., `skills/react-nextjs-tailwind/`, `skills/docker-ops-deployment/`).

### Step 2: Create a `SKILL.md` File
Every skill folder **must** contain a `SKILL.md` file at its root with valid YAML frontmatter:

```markdown
---
name: your-skill-name
description: |
  Describe exactly when the AI Agent should trigger this skill.
  Make it descriptive and comprehensive so agents easily understand context.
compatibility: claude, codex, opencode, copilot
depends: [any-dependencies-if-applicable]
metadata:
  audience: developers
  workflow: your-workflow
---

# Your Skill Title

## Capabilities
Describe what this skill enables the agent to do.

## Best Practice Patterns
Provide code templates, standards, and typical commands.

## Verification
Step-by-step commands to verify output works properly.
```

> `compatibility`, `depends`, and `metadata` are custom conventions for cross-tool
> sharing — Claude Code's plugin schema ignores them (only `name` and
> `description` are required), so they're safe to keep.

### Step 3: Add to `README.md`
Add your new skill to the directory tree above and the compatibility matrix below.

---

## 🤖 Agent Compatibility Matrix

Content-format compatible with all four out of the box — actually loading a skill
still requires it to sit in the directory name that tool scans (see
[Installation](#-installation)).

| Skill | Claude Code | Codex CLI | OpenCode | GitHub Copilot |
|-------|-------------|---------------|----------|----------------|
| **Core & Standards** | | | | |
| [magento2-dev-core](skills/magento2-dev-core/SKILL.md) | ✅ | ✅ | ✅ | ✅ |
| **Linting & Auditing** | | | | |
| [magento2-linter](skills/magento2-linter/SKILL.md) | ✅ | ✅ | ✅ | ✅ |
| [magento2-performance-audit](skills/magento2-performance-audit/SKILL.md) | ✅ | ✅ | ✅ | ✅ |
| [magento2-security-scan](skills/magento2-security-scan/SKILL.md) | ✅ | ✅ | ✅ | ✅ |
| [magento2-code-review](skills/magento2-code-review/SKILL.md) | ✅ | ✅ | ✅ | ✅ |
| **Frameworks** | | | | |
| [magento2-hyva-dev](skills/magento2-hyva-dev/SKILL.md) | ✅ | ✅ | ✅ | ✅ |
| [magento2-frontend-dev](skills/magento2-frontend-dev/SKILL.md) | ✅ | ✅ | ✅ | ✅ |
| [magento2-backend-dev](skills/magento2-backend-dev/SKILL.md) | ✅ | ✅ | ✅ | ✅ |
| **Toolchains** | | | | |
| [govard-toolbox](skills/govard-toolbox/SKILL.md) | ✅ | ✅ | ✅ | ✅ |
| [govard-magento](skills/govard-magento/SKILL.md) | ✅ | ✅ | ✅ | ✅ |
| [govard-laravel](skills/govard-laravel/SKILL.md) | ✅ | ✅ | ✅ | ✅ |

---

## 💾 Installation

Every tool recognizes the same `SKILL.md` file, but each one scans its **own**
directory name — none of them can be pointed at an arbitrary folder like this
repo's bare `skills/`, so pick the option(s) below for the tools you use.

### Claude Code — as a plugin (recommended)
```
/plugin marketplace add ddtcorex/dev-skills-hub
/plugin install dev-skills-hub@dev-skills-hub
```
Updates: `/plugin marketplace update dev-skills-hub`.

### Codex CLI — as a plugin (recommended)
```bash
codex plugin marketplace add ddtcorex/dev-skills-hub
codex plugin add dev-skills-hub@dev-skills-hub
```
Updates: `codex plugin marketplace upgrade dev-skills-hub`. Uninstall:
`codex plugin remove dev-skills-hub@dev-skills-hub` then
`codex plugin marketplace remove dev-skills-hub`.

### OpenCode & GitHub Copilot, or direct skill files — one-line install/update

Neither OpenCode nor GitHub Copilot has a plugin mechanism yet, and Claude/Codex
users who'd rather have plain skill files than an installed plugin can use this
too. Each tool scans its own directory name, so `install.sh` clones this repo
once into `~/.dev-skills-hub` and links each skill into every tool's expected
path:

```bash
curl -fsSL https://raw.githubusercontent.com/ddtcorex/dev-skills-hub/master/install.sh | bash
```

Run interactively, it asks for scope (`project` = current directory, `personal`
= your home directory, available in every project) and which tools to target.
Re-running the exact same command later **is** the update — it re-pulls the
cache and re-links. Common flags for non-interactive/CI use:

```bash
curl -fsSL .../install.sh | bash -s -- -y --scope project --target claude,codex \
  --skills magento2-dev-core,govard-toolbox --mode copy
curl -fsSL .../install.sh | bash -s -- -y --uninstall
```

| Tool | Scans (project scope) | Scans (personal scope) |
|------|------------------------|--------------------------|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| OpenCode | `.opencode/skills/` (also checks `.claude/skills/`, `.agents/skills/`) | `~/.config/opencode/skills/` |
| Codex CLI | `.agents/skills/` **only** | `~/.agents/skills/` |
| GitHub Copilot / VS Code | `.github/skills/` (also checks `.claude/skills/`, `.agents/skills/`, or a custom `chat.agentSkillsLocations` path) | `~/.copilot/skills/` |

> This table is Codex CLI's *project-level skill scan*, separate from the
> `codex plugin add` install above — that reads `.codex-plugin/plugin.json`
> directly and doesn't touch `.agents/skills/` at all. Use whichever fits: the
> plugin path if you just want the skills active, this table's paths if you
> want plain files you can inspect/edit directly in the project.

`install.sh` creates each tool's own dedicated path (symlinked to the
`~/.dev-skills-hub` cache by default, or real copies with `--mode copy`) rather than
relying on the secondary paths some tools also check, so `ls` in your project
shows exactly which tools have a copy.

> GitHub Copilot's older "Skillsets" feature (for Copilot Extensions — API tool
> integrations) is unrelated to the Agent Skills folders above; don't confuse the
> two when searching Copilot's docs.

---

*Let's continuously expand this hub to automate more of our engineering workflows!* 🚀
