# AI Agent Development Skills Hub (`agent-dev-skills`)

An extensible hub of AI development skills, packaged as a universal plugin for **DeepSeek Harness (DSH)**, **Claude Code**, **Codex CLI**, **OpenCode**, and **GitHub Copilot** — centered around **Govard** development environment orchestration and its supported web frameworks (Magento 2, Laravel, etc.), with more tech stacks added over time.

Every skill follows the open [Agent Skills standard](https://agentskills.io) (a `SKILL.md` file with `name`/`description` frontmatter), which all major AI Agent tools understand.

> **Works best with [Govard](https://github.com/ddtcorex/govard).** Most command examples in this hub assume a Govard-managed dev environment (`govard sh -c "..."`, `govard tool magerun ...`) — without it, you'll need to adapt them to your own container/CLI setup. One-line install: `curl -fsSL https://raw.githubusercontent.com/ddtcorex/govard/master/install.sh | bash`.

---

## 📂 Directory Structure

Every skill lives under `skills/<name>/SKILL.md` — this is the single source of truth across all supported AI tools and platforms:

```
agent-dev-skills/
├── README.md                        # Global documentation and guide
├── package.json                     # NPM package & DSH Cordis Plugin manifest (@ddtcorex/agent-dev-skills)
├── tsconfig.json                    # TypeScript compiler configuration
├── src/                             # DSH Cordis Plugin source code
│   ├── index.ts                     # Cordis Plugin entrypoint
│   └── dsh-types.d.ts               # DSH type definitions
├── .dsh-plugin/                     # DeepSeek Harness Agent Preset definition
│   ├── preset.yml                   # Web GUI preset display metadata
│   └── agent.cordis.yml             # DSH Agent preset composition
├── .claude-plugin/                  # Claude Code plugin manifests
├── .codex-plugin/                   # Codex CLI plugin manifest
├── .agents/plugins/                 # Codex marketplace manifest
│
└── skills/
    ├── 📦 CORE STANDARDS & ARCHITECTURES
    │   └── magento2-dev-core/           # Magento 2 core guidelines (DI, Repositories, Security)
    │
    ├── 🛠️ QUALITY ASSURANCE & AUDITING
    │   ├── magento2-linter/             # PHPCS, PHPStan, PHPMD quality checks
    │   ├── magento2-performance-audit/  # Web vitals, infrastructure and DB profiling
    │   ├── magento2-security-scan/      # Static vulnerability code scanning
    │   └── magento2-code-review/        # PR/module/theme/project review orchestration
    │
    ├── 🎨 FRONTEND & BACKEND FRAMEWORKS
    │   ├── magento2-hyva-dev/           # Alpine.js, Tailwind CSS, CSP payment pages
    │   ├── magento2-frontend-dev/       # Luma Knockout.js, LESS, RequireJS
    │   └── magento2-backend-dev/        # REST, GraphQL resolvers, Cron, Queues
    │
    └── 🔧 DEV ENVIRONMENT & CLI TOOLS (Govard Stack)
        ├── govard-toolbox/              # Base container orchestrator toolbox
        ├── govard-magento/              # Magento-specific dev env commands
        └── govard-laravel/              # Laravel-specific dev env commands
```

---

## 🤖 Agent Compatibility Matrix

| Skill | Claude Code | Codex CLI | OpenCode | GitHub Copilot | DeepSeek Harness |
|-------|-------------|---------------|----------|----------------|------------------|
| **Core & Standards** | | | | | |
| [magento2-dev-core](skills/magento2-dev-core/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Linting & Auditing** | | | | | |
| [magento2-linter](skills/magento2-linter/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |
| [magento2-performance-audit](skills/magento2-performance-audit/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |
| [magento2-security-scan](skills/magento2-security-scan/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |
| [magento2-code-review](skills/magento2-code-review/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Frameworks** | | | | | |
| [magento2-hyva-dev](skills/magento2-hyva-dev/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |
| [magento2-frontend-dev](skills/magento2-frontend-dev/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |
| [magento2-backend-dev](skills/magento2-backend-dev/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Toolchains** | | | | | |
| [govard-toolbox](skills/govard-toolbox/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |
| [govard-magento](skills/govard-magento/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |
| [govard-laravel](skills/govard-laravel/SKILL.md) | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 💾 Installation

### 1. DeepSeek Harness (DSH)

#### As a Cordis Plugin Package (`cordis.yml`)
```yaml
- id: agent-dev-skills
  name: '@ddtcorex/agent-dev-skills'
```

#### Via One-Line Installer (Installs Skills + DSH Web GUI Agent Preset)
```bash
curl -fsSL https://raw.githubusercontent.com/ddtcorex/agent-dev-skills/master/install.sh | bash -s -- --target dsh
```
This automatically installs:
- All skills into `~/.dsh/skills/`
- Agent Preset **"Govard Dev Agent"** into `~/.dsh/.agent-presets/agent-dev-skills/`

After installation, open DSH Web GUI → **New Chat** → select **"Govard Dev Agent"** from the Agent picker.

---

### 2. Claude Code — As a Plugin
```bash
/plugin marketplace add ddtcorex/agent-dev-skills
/plugin install agent-dev-skills@ddtcorex
```
Updates: `/plugin marketplace update ddtcorex`.

---

### 3. Codex CLI — As a Plugin
```bash
codex plugin marketplace add ddtcorex/agent-dev-skills
codex plugin add agent-dev-skills@ddtcorex
```
Updates: `codex plugin marketplace upgrade ddtcorex`.

---

### 4. OpenCode & GitHub Copilot, or Direct Skill Files
```bash
curl -fsSL https://raw.githubusercontent.com/ddtcorex/agent-dev-skills/master/install.sh | bash
```

| Tool | Scans (project scope) | Scans (personal scope) |
|------|------------------------|--------------------------|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| DeepSeek Harness (DSH) | `.dsh/skills/` | `~/.dsh/skills/` |
| OpenCode | `.opencode/skills/` | `~/.config/opencode/skills/` |
| Codex CLI | `.agents/skills/` | `~/.agents/skills/` |
| GitHub Copilot | `.github/skills/` | `~/.copilot/skills/` |

---

## ⚡ Extension Guide: Adding New Skills

You can easily expand this hub with any new framework or toolchain supported by Govard (e.g., Laravel, Symfony, React, Vue, Docker, etc.).

### Step 1: Create the Skill Folder
Create `skills/[framework/tool]-[purpose]/` using kebab-case (e.g., `skills/laravel-dev-core/`, `skills/vue-hyva-checkout/`).

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

*Let's continuously expand this hub to automate more AI engineering workflows across Govard and web frameworks!* 🚀
