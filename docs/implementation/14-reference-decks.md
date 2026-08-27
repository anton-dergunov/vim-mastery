# Session 14 — Reference card decks

**Depends on:** nothing · **Blocks:** nothing
**Touches:** new content files, Reference destination in `app.js`, `styles.css`
**Size:** M

## Context

Three bodies of knowledge belong in the product but must not become lessons.

**Why not lessons:** every activity is defined by an initial buffer, a target
buffer, a cursor, and a mode. `:q` has no target state — the editor in an
exercise is by definition already open and stays open. Authoring `:wq` as an
exercise would teach the keystroke while demonstrating the opposite of its
effect. The format cannot represent these commands honestly.

**Why include them anyway:** a learner who never opens standalone Vim will
eventually land in a `git commit` buffer or an SSH session. And two of the cards
below serve the automation goal more directly than anything currently in the
curriculum.

## Scope

### 1. Survival deck

No progression, no unlocking, no exercises. Six cards:

1. **Leaving safely** — `:w`, `:q`, `:x`, `ZZ`, `ZQ`, `:q!`; what "modified
   buffer" means and when a forced form is destructive.
2. **Files and buffers** — `:e`, `:ls`, `:b`, `:bd`; buffer vs window vs tab.
3. **Windows** — `:sp`, `:vs`, `Ctrl-w hjkl`, `Ctrl-w c`, `Ctrl-w o`.
4. **Help** — `:help {topic}`, `Ctrl-]`, `Ctrl-t`.
5. **Starting Vim with work queued** — `vim -c 'commands' file`, `vim -es`,
   `ex -sc`.
6. **Filters and shell** — `:%!sort`, `:r !cmd`, `!{motion}cmd`.

Cards 5 and 6 are the ones that serve automation directly, and a conventional
"how to quit Vim" lesson would never include them.

### 2. The host column

**This is what turns the deck from trivia into usable knowledge.** Every card
carries two columns: what the command does in terminal Vim, and what happens in
VS Code (`:w` works; `:q` closes the editor tab; `:sp` splits the editor group).

### 3. Host-reality card

One card listing the chords the primary target host claims by default, because
they affect commands the curriculum actually teaches:

| Chord | VS Code default | Affects |
| --- | --- | --- |
| `Ctrl-f` | Find | Unit 9 |
| `Ctrl-b` | Toggle sidebar | Unit 9 |
| `Ctrl-e` | Quick open | Unit 9 |
| `Ctrl-y` | Redo | Unit 9 |
| `Ctrl-d` | Add cursor at next match | Unit 9 |
| `Ctrl-w` | Close editor | Unit 3 (after session 11) |
| `Ctrl-r` | Recent files | Units 3, 8 |
| `Ctrl-v` | Paste (Win/Linux) | Unit 7 |
| `Ctrl-a` / `Ctrl-x` | Select all / cut | Unit 3 |

Also note that `gq` and `=` behave differently or not at all without
configuration, and that `:normal` and `:g` support in the VS Code extension is
narrower than real Vim.

**Do not teach configuration.** Tell the learner which keys need a decision and
stop there. The point is that they are not confused when a practiced command
does nothing.

### 4. Tier 3 reference entries

Fold in the remaining reference-only items from the review: `q:` command-line
window, `:earlier`/`:later`, `"*` versus `"+`, and the material demoted by
sessions 07 and 10 (section motions, scroll chords, sentence motions, `gq`).

## Out of scope

- Any progression, unlocking, scoring, or exercise attached to these cards.
- Teaching `vim.handleKeys` or any extension configuration.
- `:argdo` / `:bufdo` / quickfix — session 17 treats those as taught material,
  not reference.

## Acceptance criteria

- The survival deck exists under Reference with six cards and no progression.
- Every card has a terminal-Vim column and a VS Code column.
- The host-reality card lists every reserved chord affecting a taught command.
- Demoted material from sessions 07 and 10 has a reference home.
- Cards are readable at 360px without horizontal scrolling — two-column content
  is the risk here; stack the columns on narrow screens.

## Validation

```bash
node --check app.js && git diff --check
npm test
```

Inspect the full viewport matrix. Two-column cards are the most likely new
source of horizontal overflow in this plan.
