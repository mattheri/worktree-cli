# worktree-cli

Interactive CLI for managing git worktrees: list, jump between, clean up, and bulk-update against `master`.

## Install

```sh
npm install -g @matheriault/worktree-cli
```

## Quick start

After install, run the one-time setup to add `wt` and `claude -w` shell functions to your rc file:

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
| Create | Prompt for a name (with a dynamic char budget) and create a worktree off `master` |
| Clean | Auto-remove merged+clean worktrees, prompt for the rest, then prune stale refs |
| Update | Fetch `origin/master` and merge into every worktree (per-branch handling for dirty trees: stash / merge anyway / skip) |
| Setup | Re-install the shell integration |

You can skip the menu by passing `--action`:

```sh
wt --action list
wt --action clean
```

### `claude -w [name]`

Shortcut for "create a worktree and drop me into Claude Code in it":

```sh
claude -w            # prompts for the name
claude -w my-feature # uses the given name
```

It creates the worktree off `master`, `cd`s into it, and launches `claude` for you.

### `WorktreeCreate` hooks

If your repo registers a `WorktreeCreate` hook in `.claude/settings.json` (or `~/.claude/settings.json`), `wt` delegates worktree creation to it instead of running its own `git worktree add`. Useful for repo-specific setup like symlinking `node_modules` or copying gitignored config files.

The hook receives `{name, cwd, hook_event_name}` as JSON on stdin and must echo the absolute worktree path on stdout. Example registration:

```json
{
  "hooks": {
    "WorktreeCreate": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command", "command": ".claude/hooks/create-worktree.sh" }
        ]
      }
    ]
  }
}
```

If multiple hooks are registered, the first one runs.

### Choosing how `wt` creates worktrees

The first time you run `wt --action create`, you're asked once how you'd like to add new worktrees: **with Claude** (creates the worktree, `cd`s in, launches `claude`) or **plain `git worktree add`**. Your choice is saved at `~/.wt-cli/config.json` (or `$XDG_CONFIG_HOME/wt-cli/config.json` if that env var is set). Delete that file to be re-prompted.

`claude -w` always uses the Claude path regardless of this preference.

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

## Uninstall

Run the rc-file cleanup **before** removing the package — npm 7+ no longer fires `preuninstall` for global packages, so this step is manual:

```sh
wt-cli --action uninstall
npm uninstall -g @matheriault/worktree-cli
```

If you've already removed the package, the `wt` / `claude -w` block is still in `~/.zshrc` (or `~/.bash_profile`); delete the lines between `# worktree-cli shell integration` and the second closing `}` (the one closing `claude()`).

## License

MIT
