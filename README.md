# Maestro Skills (`maestro-skills`)

A unified skills library for AI coding agents, packaged as a universal plugin for **DeepSeek Harness (DSH)**, **Claude Code**, **Codex CLI**, **OpenCode**, and **GitHub Copilot** — two halves in one bundle:

- **Domain skills (11)** — **Govard** development-environment orchestration and its supported web frameworks (**Magento 2**, Laravel): architecture, linting, performance auditing, security scanning, code review, Hyvä/Luma frontend, backend APIs.
- **Process skills (14)** — the complete [**superpowers**](https://github.com/obra/superpowers) methodology forked verbatim from v6.3.0 (MIT, © Jesse Vincent): brainstorming, test-driven development, systematic debugging, writing/executing plans, subagent-driven development, code-review collaboration, and more. See `THIRD-PARTY-NOTICES.md` for license and sync policy.

Every skill follows the open [Agent Skills standard](https://agentskills.io) (a `SKILL.md` file with `name`/`description` frontmatter), which all major AI Agent tools understand.

> **Works best with [Govard](https://github.com/ddtcorex/govard).** Most command examples in the domain skills assume a Govard-managed dev environment (`govard sh -c "..."`, `govard tool magerun ...`) — without it, you'll need to adapt them to your own container/CLI setup. One-line install: `curl -fsSL https://raw.githubusercontent.com/ddtcorex/govard/master/install.sh | bash`.

---

## 📂 Directory Structure

Every skill lives under `skills/<name>/SKILL.md` — this is the single source of truth across all supported AI tools and platforms:

```
maestro-skills/
├── README.md                        # Global documentation and guide
├── package.json                     # NPM package & DSH Cordis Plugin manifest (@ddtcorex/maestro-skills)
├── THIRD-PARTY-NOTICES.md           # Superpowers fork attribution + MIT license text
├── scripts/
│   └── sync-superpowers.sh          # Refresh the superpowers fork from upstream
├── tsconfig.json                    # TypeScript compiler configuration
├── src/                             # DSH Cordis Plugin source code
│   ├── index.ts                     # Cordis plugin entrypoint: serves packaged skills + installs the DSH agent preset
│   └── dsh-types.d.ts               # DSH type definitions
├── .dsh-plugin/                     # DeepSeek Harness Agent Preset definition
│   ├── preset.yml                   # Web GUI preset display metadata ("Maestro Skills")
│   └── agent.cordis.yml             # DSH Agent preset composition
├── .claude-plugin/                  # Claude Code plugin manifests
├── .codex-plugin/                   # Codex CLI plugin manifest
├── .agents/plugins/                 # Codex marketplace manifest
│
└── skills/                          # 25 skills total
    ├── 🧠 PROCESS SKILLS (forked from obra/superpowers v6.3.0)
    │   ├── brainstorming/              # Socratic design refinement with approval gates
    │   ├── test-driven-development/    # RED-GREEN-REFACTOR iron law
    │   ├── systematic-debugging/       # 4-phase root-cause process
    │   ├── verification-before-completion/  # Evidence before success claims
    │   ├── writing-plans/ + executing-plans/
    │   ├── subagent-driven-development/ + dispatching-parallel-agents/
    │   ├── requesting/receiving-code-review/
    │   ├── using-git-worktrees/ + finishing-a-development-branch/
    │   ├── writing-skills/             # How to author new skills
    │   └── using-superpowers/          # Skill-system introduction (+ DSH tool map)
    │
    ├── 📦 CORE STANDARDS & ARCHITECTURES
    │   └── magento2-dev-core/           # Magento 2 core guidelines (DI, Repositories, Security)
    ├── 🛠️ QUALITY ASSURANCE & AUDITING
    │   ├── magento2-linter/             # PHPCS, PHPStan, PHPMD quality checks
    │   ├── magento2-performance-audit/  # Web vitals, infrastructure and DB profiling
    │   ├── magento2-security-scan/      # Static vulnerability code scanning
    │   └── magento2-code-review/        # PR/module/theme/project review orchestration
    ├── 🎨 FRONTEND & BACKEND FRAMEWORKS
    │   ├── magento2-hyva-dev/           # Alpine.js, Tailwind CSS, CSP payment pages
    │   ├── magento2-frontend-dev/       # Luma Knockout.js, LESS, RequireJS
    │   └── magento2-backend-dev/        # REST, GraphQL resolvers, Cron, Queues
    └── 🔧 DEV ENVIRONMENT & CLI TOOLS (Govard Stack)
        ├── govard-toolbox/              # Base container orchestrator toolbox
        ├── govard-magento/              # Magento-specific dev env commands
        └── govard-laravel/              # Laravel-specific dev env commands
```

---

## 🤖 Skill Compatibility Matrix

All 25 skills work identically on every listed tool.

| Group | Skills | Claude Code | Codex CLI | OpenCode | GitHub Copilot | DeepSeek Harness |
|---|---|---|---|---|---|---|
| Process (superpowers fork) | brainstorming, dispatching-parallel-agents, executing-plans, finishing-a-development-branch, receiving-code-review, requesting-code-review, subagent-driven-development, systematic-debugging, test-driven-development, using-git-worktrees, using-superpowers, verification-before-completion, writing-plans, writing-skills | ✅ | ✅ | ✅ | ✅ | ✅ |
| Core & Standards | [magento2-dev-core](skills/magento2-dev-core/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Linting & Auditing | [magento2-linter](skills/magento2-linter/SKILL.md), [magento2-performance-audit](skills/magento2-performance-audit/SKILL.md), [magento2-security-scan](skills/magento2-security-scan/SKILL.md), [magento2-code-review](skills/magento2-code-review/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Frameworks | [magento2-hyva-dev](skills/magento2-hyva-dev/SKILL.md), [magento2-frontend-dev](skills/magento2-frontend-dev/SKILL.md), [magento2-backend-dev](skills/magento2-backend-dev/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Toolchains (Govard) | [govard-toolbox](skills/govard-toolbox/SKILL.md), [govard-magento](skills/govard-magento/SKILL.md), [govard-laravel](skills/govard-laravel/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 💾 Installation

### 1. DeepSeek Harness (DSH) — as a plugin (recommended)

One command is a complete install — the plugin serves all 25 packaged skills itself **and** materializes the **"Maestro Skills"** agent preset into `~/.dsh/.agent-presets/maestro-skills/` at startup:

```bash
dsh plugin --profile web add github:ddtcorex/maestro-skills
```

Then restart `dsh web` and pick **Maestro Skills** in the Web GUI agent picker. No install.sh needed.

The package builds itself on install via its `prepare` script. pnpm ≥ 10 blocks git-dependency build scripts until you allow them — if the first add reports an ignored build, copy the key pnpm prints into the profile's `pnpm-workspace.yaml` and re-run:
```yaml
allowBuilds:
  '@ddtcorex/maestro-skills': true
```

To reference the plugin from a hand-written patch layer instead, the row must name the real package:
```yaml
- insert:
    - id: maestro-skills
      name: '@ddtcorex/maestro-skills'
```

<details>
<summary>Alternative: loose skill files via installer (no plugin)</summary>

```bash
curl -fsSL https://raw.githubusercontent.com/ddtcorex/maestro-skills/master/install.sh | bash -s -- --target dsh
```
Links all skills into `~/.dsh/skills/` and copies the agent preset into `~/.dsh/.agent-presets/maestro-skills/`.
</details>

---

### 2. Claude Code — as a plugin
```bash
/plugin marketplace add ddtcorex/maestro-skills
/plugin install maestro-skills@ddtcorex
```
Updates: `/plugin marketplace update ddtcorex`.

---

### 3. Codex CLI — as a plugin
```bash
codex plugin marketplace add ddtcorex/maestro-skills
codex plugin add maestro-skills@ddtcorex
```
Updates: `codex plugin marketplace upgrade ddtcorex`.

---

### 4. OpenCode & GitHub Copilot, or Direct Skill Files
```bash
curl -fsSL https://raw.githubusercontent.com/ddtcorex/maestro-skills/master/install.sh | bash
```

| Tool | Scans (project scope) | Scans (personal scope) |
|------|------------------------|--------------------------|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| DeepSeek Harness (DSH) | `.dsh/skills/` | `~/.dsh/skills/` |
| OpenCode | `.opencode/skills/` | `~/.config/opencode/skills/` |
| Codex CLI | `.agents/skills/` | `~/.agents/skills/` |
| GitHub Copilot | `.github/skills/` | `~/.copilot/skills/` |

---

## 🔄 Superpowers fork maintenance

The 14 process skills are an upstream fork, not hand-maintained copies:

```bash
scripts/sync-superpowers.sh            # latest upstream HEAD
scripts/sync-superpowers.sh v6.4.0     # a specific tag
```

The script preserves this repo's local additions (`skills/using-superpowers/references/dsh-tools.md`, the fork-provenance note in `using-superpowers/SKILL.md`) and prints a diff for review. Do not edit forked skill bodies by hand — see `THIRD-PARTY-NOTICES.md`.

## ⚡ Extension Guide: Adding New Domain Skills

You can easily expand this hub with any new framework or toolchain supported by Govard (e.g., Laravel, Symfony, React, Vue, Docker, etc.).

### Step 1: Create the Skill Folder
Create `skills/[framework/tool]-[purpose]/` using kebab-case (e.g., `skills/laravel-dev-core/`, `skills/vue-hyva-checkout/`). For *process* skills, don't create them here — contribute upstream to obra/superpowers instead.

### Step 2: Create a `SKILL.md` File
Every skill folder **must** contain a `SKILL.md` file at its root with valid YAML frontmatter:

```markdown
---
name: your-skill-name
description: |
  Describe exactly when the AI Agent should trigger this skill.
compatibility: claude, codex, opencode, copilot, dsh
depends: [any-dependencies-if-applicable]
---

# Your Skill Title

## Capabilities
Describe what this skill enables the agent to do.

## Best Practice Patterns
Provide code templates, standards, and typical commands.

## Verification
Step-by-step commands to verify output works properly.
```

---

*One bundle, one workflow: Govard domain expertise plus superpowers process discipline.* 🚀

## Credits & Attribution

- **Domain skills**: © DDTCoreX, MIT License (see `LICENSE`).
- **Process skills**: forked from [obra/superpowers](https://github.com/obra/superpowers) v6.3.0 by Jesse Vincent / Prime Radiant, MIT License — full notice in `THIRD-PARTY-NOTICES.md`. The DSH tool mapping (`references/dsh-tools.md`) is a local addition, not upstream content.
