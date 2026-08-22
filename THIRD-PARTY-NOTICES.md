# Third-Party Notices

This repository bundles third-party open-source software.

## Superpowers (14 process skills)

The following skills are forked verbatim from
[obra/superpowers](https://github.com/obra/superpowers) **v6.3.0**
(release 2026-08-12):

- brainstorming
- dispatching-parallel-agents
- executing-plans
- finishing-a-development-branch
- receiving-code-review
- requesting-code-review
- subagent-driven-development
- systematic-debugging
- test-driven-development
- using-git-worktrees
- using-superpowers
- verification-before-completion
- writing-plans
- writing-skills

Local additions on top of the fork (not upstream content):

- `skills/using-superpowers/references/dsh-tools.md` — DeepSeek Harness tool
  mapping.
- A short fork-provenance note and an un-namespaced invocation note in
  `skills/using-superpowers/SKILL.md`.

Upstream is licensed MIT:

```
MIT License

Copyright (c) 2025 Jesse Vincent

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Sync policy: refresh the forked skills with `scripts/sync-superpowers.sh`
(pulls upstream and preserves the local additions above). Do not hand-edit the
forked skill bodies; upstream is their single source of truth.
