# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A dual-ecosystem plugin (`dev-skills-hub`) bundling 11 Magento 2 and Govard
development skills, distributed via self-listing marketplaces for both Claude
Code and Codex CLI. There is no build step, no test suite, and no application
code — the repository *is* the plugin (in both ecosystems at once), and its
content is Markdown (`SKILL.md`) plus four JSON manifests and one install
script.

## Architecture

### Single source of truth: `skills/<name>/SKILL.md`

Every skill lives under `skills/<name>/SKILL.md` and **nowhere else**. This is
not a stylistic choice — it's a hard requirement of the Claude Code plugin
loader, which only auto-discovers `skills/<subdir>/SKILL.md` at the plugin
root. Earlier iterations of this repo kept skills in a flat top-level layout
(`magento2-dev-core/SKILL.md`) plus generated copies/symlinks in `skills/` for
plugin compatibility; that dual-location approach was deliberately abandoned
in favor of one location. Do not reintroduce a second copy of skill content
anywhere in the repo (no symlinks, no build-generated duplicates) — if a
change needs skill content in a different shape, change how it's *consumed*,
not where it lives.

### The plugin self-lists its own marketplace — for two ecosystems

This repo ships two independent plugin manifests, one per ecosystem, that
both point at the *same* `skills/` directory so neither duplicates content:

- **Claude Code**: `.claude-plugin/plugin.json` and
  `.claude-plugin/marketplace.json` live side by side. `marketplace.json` has
  exactly one entry, with `"source": "./"`, pointing back at the repo root
  where `plugin.json` itself lives — this repo is simultaneously "a plugin"
  and "the marketplace that hosts that one plugin."
- **Codex CLI**: since Codex's plugin marketplace launched (March 2026), it
  reads the exact same `skills/<name>/SKILL.md` layout through its own
  `.codex-plugin/plugin.json` (with an explicit `"skills": "./skills/"`
  pointer, since Codex does not auto-discover a root `skills/` folder the way
  Claude's plugin loader does) plus a repo-scoped
  `.agents/plugins/marketplace.json` that self-lists this repo the same way
  (`"source": {"source": "local", "path": "./"}`). Verified end-to-end
  against the real `codex` binary: `codex plugin marketplace add .` then
  `codex plugin add dev-skills-hub@dev-skills-hub` resolves all 11 skills
  with zero copying.

Both marketplaces' top-level `name` and the plugin's `name` are kept
identical (`dev-skills-hub`) on purpose, so `plugin install
dev-skills-hub@dev-skills-hub` reads as one coherent thing on either tool.
The **version field must be bumped in three places together** —
`.claude-plugin/plugin.json`'s `version`, `.claude-plugin/marketplace.json`'s
`plugins[0].version` / `metadata.version`, and `.codex-plugin/plugin.json`'s
`version` (Codex's `.agents/plugins/marketplace.json` has no version field of
its own) — nothing enforces they match automatically.

### One SKILL.md format, four incompatible project-level paths, two plugin loaders

All 11 skills follow the [Agent Skills standard](https://agentskills.io) (a
`SKILL.md` file with `name`/`description` YAML frontmatter) — a format Claude
Code, OpenCode, Codex CLI, and GitHub Copilot all read identically. What
differs is which directory name each tool scans in a *consuming project* for
loose (non-plugin) skills, and none of them can be pointed at an arbitrary
path:

| Tool | Project-level path |
|---|---|
| Claude Code | `.claude/skills/` |
| OpenCode | `.opencode/skills/` (also checks `.claude/skills/`, `.agents/skills/`) |
| Codex CLI | `.agents/skills/` only |
| GitHub Copilot | `.github/skills/` (also checks `.claude/skills/`, `.agents/skills/`, or `chat.agentSkillsLocations`) |

This repo's own bare `skills/` folder matches **none** of those project-level
paths — it works for two tools, but for two different reasons:

- **Claude Code**'s *plugin* loader (a separate mechanism from project-level
  skill scanning) specifically looks for `skills/` at plugin root.
- **Codex CLI**, since its plugin marketplace launch, has an equivalent
  separate plugin loader — a `.codex-plugin/plugin.json` with its own
  `skills` pointer — that is likewise independent of the `.agents/skills/`
  project-level scan in the table above.

OpenCode and GitHub Copilot have no plugin-loader equivalent as of this
writing. `install.sh` exists to bridge the gap for direct (non-plugin) use on
any tool — including Claude/Codex users who'd rather symlink skill files than
install a plugin: it never tries to make one folder satisfy all four tools,
it links per-tool into whichever directory each one actually scans.

### Skill dependency chain

Some skills declare a non-enforced `depends:` frontmatter field documenting a
conceptual prerequisite (Claude Code's schema ignores it; it's a
cross-tool-sharing convention along with `compatibility` and `metadata`):

- `magento2-dev-core` is the foundation; `magento2-linter`,
  `magento2-performance-audit`, `magento2-security-scan`,
  `magento2-hyva-dev`, `magento2-frontend-dev`, `magento2-backend-dev`, and
  `magento2-code-review` all declare `depends: [magento2-dev-core]`.
- `govard-toolbox` is the foundation; `govard-magento` and `govard-laravel`
  both declare `depends: [govard-toolbox]`.

When editing a dependency's SKILL.md (`magento2-dev-core`, `govard-toolbox`),
check whether the change invalidates guidance in the skills that depend on it.

### Adding a lesson to a skill reference file

**MUST:** load the `superpowers:writing-skills` skill before writing content, not
just as a style check afterward — it governs testing and structure, not only length.

**MUST:** budget ~170–220 words of prose per lesson (a `>` callout or `##` section
documenting one real finding), excluding code blocks — this hub's own established
house style. Measure the section in isolation before calling it done:
```bash
sed -n '/## Lesson Heading/,/## Next Heading/p' path/to/file.md | sed '/```/,/```/d' | wc -w
```
This has been missed and fixed after the fact **twice** (0.4.13→0.4.14,
0.4.14→0.4.15 — see CHANGELOG.md). Both times the overage came from narrating the
investigation ("first I thought X was the cause, then I discovered Y") — state the
corrected mechanism directly, don't walk the reader through how you got there.

### `install.sh` design

One-line installer/updater (`curl -fsSL .../install.sh | bash`). Key points if
modifying it:

- **Clone-once-to-cache, link-out-per-tool**: clones this repo into
  `~/.dev-skills-hub` (override: `DEV_SKILLS_HUB_HOME`); re-running the same
  command is the update path (`git pull --ff-only` + re-link) — there is no
  separate `update.sh`.
- **TTY handling follows the rustup-init.sh pattern**: `[ -t 0 ]` for a real
  interactive stdin, else fall back to `< /dev/tty` if `[ -t 1 ]` (stdout is
  still a real terminal even though stdin was consumed by the `curl | bash`
  pipe), else silently use defaults (CI-safe). Don't replace this with a
  plain `read` — it will hang or misbehave under `curl | bash`.
- **Manifest-based safety**: every path it creates is recorded in
  `$CACHE_DIR/.manifest`. A pre-existing path not in that manifest is treated
  as user-owned and skipped unless `--force` — this is what stops the
  installer from clobbering a user's own hand-written skill of the same name.
  Don't remove this check to "simplify" the linking loop.
- Env vars mirror the flags and are prefixed `DEV_SKILLS_HUB_*` (`_HOME`,
  `_SCOPE`, `_TARGET`, `_SKILLS`, `_MODE`) — keep this prefix if adding new
  configurable behavior.

## Commands

There is no build/lint/test framework — validation is structural (does the
plugin manifest resolve correctly?) and, for `install.sh`, behavioral (does it
actually link/unlink files correctly?).

```bash
# Validate plugin + marketplace manifest (must be run from repo root)
claude plugin validate . --strict

# Inspect what the plugin loader actually resolves (skills found, token cost)
claude --plugin-dir . plugin details dev-skills-hub

# Full local install/uninstall round-trip against the working tree (not a
# published release) -- always clean up after testing, this registers real
# state in the local Claude Code config:
claude plugin marketplace add .
claude plugin install dev-skills-hub@dev-skills-hub
# ... test ...
claude plugin uninstall dev-skills-hub@dev-skills-hub
claude plugin marketplace remove dev-skills-hub

# Codex CLI has no `plugin validate` subcommand -- the only real check is a
# live round-trip. Use $CODEX_HOME to keep it out of your real Codex config:
export CODEX_HOME=$(mktemp -d)
codex plugin marketplace add .
codex plugin list --available --json   # confirm dev-skills-hub@dev-skills-hub is listed
codex plugin add dev-skills-hub@dev-skills-hub
codex plugin list --json               # confirm it installed and all 11 skills resolved
unset CODEX_HOME                       # the temp dir is disposable -- nothing else to clean up

# install.sh: syntax check and dry test in an isolated scratch dir (never
# test --scope personal against your real $HOME -- override HOME and
# DEV_SKILLS_HUB_HOME to a scratch path first). Note: install.sh's REPO_URL
# points at GitHub, so testing local/uncommitted changes to skills/ requires
# either a temporary local git remote (init+commit a scratch copy and point
# REPO_URL at it) or pushing first -- git clone never sees uncommitted work.
bash -n install.sh
bash install.sh --help
```

## Release checklist

Pushing a `vX.Y.Z` tag triggers `.github/workflows/release.yml`, which
validates the manifests, extracts the matching `## [X.Y.Z]` section from
`CHANGELOG.md`, and publishes a GitHub Release automatically — there is no
manual release step in the GitHub UI.

1. Add a new `## [X.Y.Z] - YYYY-MM-DD` section at the top of `CHANGELOG.md`
   (Keep a Changelog format: `### Added` / `### Changed` / `### Fixed` etc.).
2. Bump `"version"` in `.claude-plugin/plugin.json`.
3. Bump `"version"` in `.claude-plugin/marketplace.json` — both
   `plugins[0].version` and top-level `metadata.version` — to the same value.
4. Bump `"version"` in `.codex-plugin/plugin.json` to the same value
   (`.agents/plugins/marketplace.json` has no version field to update).
5. If `skills/` changed, run `claude plugin validate . --strict` and
   `claude --plugin-dir . plugin details dev-skills-hub` locally first; for a
   change that affects Codex specifically, also run the
   `codex plugin marketplace add .` / `codex plugin add` round-trip from the
   Commands section above.
6. Commit, then tag and push:
   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z - <one-line summary>"
   git push origin master
   git push origin vX.Y.Z
   ```
7. Confirm the workflow succeeded and the release published:
   ```bash
   gh run list --repo ddtcorex/dev-skills-hub --limit 1
   gh release view vX.Y.Z --repo ddtcorex/dev-skills-hub
   ```
8. If the workflow fails on the changelog-extraction step, it's almost always
   because the `## [X.Y.Z]` header in `CHANGELOG.md` doesn't exactly match the
   pushed tag's version (the workflow strips a leading `v` from the tag and
   looks for `[X.Y.Z]` literally). The release workflow's manifest-validation
   step also runs `jq empty` on `.codex-plugin/plugin.json` and
   `.agents/plugins/marketplace.json` now — a JSON syntax error in either
   fails the release the same way a bad `.claude-plugin/*.json` always did.
