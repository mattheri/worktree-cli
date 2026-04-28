# worktree-cli

Interactive CLI for managing git worktrees: list, jump between, clean up, and bulk-update against `master`.

## Install

```sh
npm install -g worktree-cli
```

## Quick start

After install, run the one-time setup to add a `wt` shell function to your rc file:

```sh
wt-cli --action setup
source ~/.zshrc   # or ~/.bash_profile / ~/.bashrc
```

Then, from inside any git repository:

```sh
wt
```

You'll get an interactive menu:

| Action | What it does |
|---|---|
| List | Show every worktree with branch, clean/dirty status, and merge state |
| Change directory | Autocomplete-pick a worktree and `cd` into it |
| Go to root | `cd` back to the repo root |
| Clean | Auto-remove merged+clean worktrees, prompt for the rest, then prune stale refs |
| Update | Fetch `origin/master` and merge into every worktree (per-branch handling for dirty trees: stash / merge anyway / skip) |
| Setup | Re-install the shell integration |

You can skip the menu by passing `--action`:

```sh
wt --action list
wt --action clean
```

## Why two commands (`wt` vs `wt-cli`)?

- **`wt-cli`** is the actual Node binary installed by npm.
- **`wt`** is a tiny shell function (written by `wt-cli --action setup`) that wraps `wt-cli` and forwards any "change directory" requests to your *parent* shell — a child process can't `cd` for its parent, so the wrapper is required for `wt cd` and `wt root` to work.

You can run `wt-cli` directly for everything except `cd` / `root`.

## Requirements

- Node ≥ 18
- `git`
- zsh, or bash (auto-uses `~/.bash_profile` on macOS, `~/.bashrc` elsewhere)

## Conventions

The CLI looks for worktrees under `<repo-root>/.claude/worktrees/`. Other worktrees registered with `git worktree add` are ignored.

## License

MIT
