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
carries two columns: what the command does in terminal Vim — the reference
behavior — and how an embedding editor is likely to differ (`:w` works; `:q`
closes a tab; `:sp` splits an editor group).

Terminal Vim is the left column and the baseline, because that is what the
curriculum teaches. Name specific hosts only as examples inside the right column;
this is a reference card, the one place a host name is useful, and even here no
single host is *the* target.

### 3. Host-reality card

One card listing chords that embedding editors commonly claim, because they
affect commands the curriculum actually teaches. **All of these work natively in
terminal Vim** — that is the point of the card, and the reason none of this is a
reason to stop teaching them:

| Chord | Vim | Commonly claimed by a host as | Affects |
| --- | --- | --- | --- |
| `Ctrl-f` | Page forward | Find | Unit 10 |
| `Ctrl-b` | Page back | Toggle sidebar | Unit 10 |
| `Ctrl-e` | Scroll down one row | Quick open | Unit 10 |
| `Ctrl-y` | Scroll up one row | Redo | Unit 10 |
| `Ctrl-d` | Half page down | Add cursor at next match | Unit 10 |
| `Ctrl-o` | Jump back | — | Unit 9 |
| `Ctrl-w` | Delete word before cursor | Close editor | Unit 3 (after session 11) |
| `Ctrl-r` | Redo; register insert | Recent files | Units 3, 8 |
| `Ctrl-v` | Visual Block | Paste (Windows/Linux) | Unit 7 |
| `Ctrl-a` / `Ctrl-x` | Increment / decrement | Select all / cut | Unit 3 |

Also note that `gq` and `=` depend on an authored `textwidth` and `equalprg`
even in terminal Vim, and that `:normal` and `:g` support in embedded Vim
emulators is usually narrower than the real thing.

**Do not teach configuration.** Tell the learner which keys need a decision in
whichever host they use, and stop there. The point is that they are not confused
when a practiced command does nothing — not that they should avoid the command.

### 4. Tier 3 reference entries

Fold in the remaining reference-only items from the review: `q:` command-line
window, `:earlier`/`:later`, and `"*` versus `"+`.

**Note what is *not* in this list.** Section motions, scroll chords, sentence
motions, and `gq` were never demoted — sessions 07 and 10 mark them
`advanced`/`optional` and keep them as full lessons, per constraint 7 in
[README.md](README.md). They may gain reference entries here in addition to
their lessons; they do not move here instead of them.

Once this deck exists, "demote to reference" becomes an available disposition for
the first time. It still should not be used on material the author has not yet
walked.

## Out of scope

- Any progression, unlocking, scoring, or exercise attached to these cards.
- Teaching `vim.handleKeys` or any extension configuration.
- `:argdo` / `:bufdo` / quickfix — session 17 treats those as taught material,
  not reference.

## Acceptance criteria

- The survival deck exists under Reference with six cards and no progression.
- Every card has a terminal-Vim column and a VS Code column.
- The host-reality card lists every reserved chord affecting a taught command.
- Marked material from sessions 07 and 10 keeps its lessons and may also have a reference entry.
- Cards are readable at 360px without horizontal scrolling — two-column content
  is the risk here; stack the columns on narrow screens.

## Validation

```bash
node --check app.js && git diff --check
npm test
```

Inspect the full viewport matrix. Two-column cards are the most likely new
source of horizontal overflow in this plan.
