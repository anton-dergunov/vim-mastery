# Vim engine choice

A decision record, made in July 2026 and still the architecture: why the app
runs CodeMirror 6 with `@replit/codemirror-vim`, and what that lets the
product claim. How the engine is tested is in
[vim-conformance.md](vim-conformance.md); how it is wired is in `vim-engine.js`
and `src/app/main.js`.

## Decision

Use **CodeMirror 6** as the browser editor and **`@replit/codemirror-vim`** as
the Vim command engine. Do not implement Vim behavior from scratch, and do not
embed native Vim or Neovim as the runtime. Native Vim is the **development and
conformance oracle**, never the interface learners use.

Guided exercises, Explore, and free practice all run the same engine, behind one
adapter (`vim-engine.js`) so a different engine could be added later without
rewriting the lesson UI.

> CodeMirror owns the document and rendering. CodeMirror Vim interprets Vim
> commands. The Vim Wilds owns lessons, validation, hints, animation, and
> progression. Native Vim verifies behavior in tests.

## Why this fits

The app needs more than a text box that accepts Vim keys. It must render
readable code inside a heavily customized phone UI; accept both the on-screen
and a physical keyboard; expose cursor, selection, document, mode, registers,
and command activity to the lesson system; reset exercises deterministically;
highlight affected ranges while a command is explained; drive hints, character
reactions, and effects from editing events; stay responsive and offline; and
support unrestricted free practice without a second editing implementation.

CodeMirror 6 is a modular editor: its state holds the document and selection,
changes are transactions, and extensions can observe or decorate behavior. That
gives the game a semantic editor surface rather than a terminal-shaped bitmap.
`@replit/codemirror-vim` supplies maintained Vim bindings for it and keeps the
older CodeMirror Vim API through `getCM(view)` — `Vim.handleKey` for
programmatic keys, `Vim.defineEx`, `Vim.map`, `Vim.defineOperator` — which is
exactly the seam the touch keyboard and lesson instrumentation need.

## What the product may claim

CodeMirror Vim is an emulation layer descended from the CodeMirror 5 Vim
keymap. It implements a large, useful subset of Vim, but it does not run Vim's
C runtime, Vimscript, terminal UI, filesystem model, or complete command set.

The product **may** claim real editing of a real text buffer, Vim-style modal
behavior, a documented and tested command set, and behavior checked against
native Vim for every command it teaches.

The product **must not** claim a complete Vim or Neovim emulator, compatibility
with `.vimrc` files or plugins, complete Ex, regex, scripting, buffer, window,
or terminal behavior, or that every host editor's Vim plugin behaves the same.

"Real behavior" means every taught command has conformance tests against native
Vim — not that a Vim binary secretly renders the exercise.

## Who owns what

- **CodeMirror 6:** the document, cursor and selections, rendering and
  scrolling, syntax highlighting, undo/redo history, teaching decorations, and
  physical-keyboard input.
- **`@replit/codemirror-vim`:** modes, counts, motions and operators, text
  objects, Visual modes, registers and puts, search and repeat, macros, and
  the Ex commands the app does not own.
- **`vim-engine.js`:** the adapter boundary — key normalization, snapshots,
  events, and the Ex and search command-line text. It also owns one closed set
  of Ex commands, interpreted before falling through to `Vim.handleEx`:
  `:global`/`:vglobal`, `:normal`, and the line operations `:delete`, `:yank`,
  `:put`, `:copy`/`:t`, `:move`/`:m`, `:join`, `:sort`, and `:print`/`:number`.
  Adding to that set needs both conformance tiers and a note in
  `vim-conformance.md`.
- **The Vim Wilds (`src/app/main.js` and friends):** exercises, initial and target
  states, touch-keyboard input, the command tray, hints and copy, validation,
  progress, effects, and story.

Nothing reaches into CodeMirror Vim internals from UI components; everything
goes through the adapter.

## Alternatives rejected

### Implementing Vim ourselves

The hard part is not `h j k l` or `dw`. It is the exact interactions between
commands: count multiplication; operator-pending state; inclusive, exclusive,
linewise, and blockwise ranges; text-object edge cases; three Visual modes;
numbered registers and put semantics; undo grouping and dot-repeat; search and
character-find repetition; marks and jumps; macros with recorded insertions;
command-line ranges; Vim regex and replacement semantics; `:normal` and
`:global`. Small differences teach bad habits, and a custom engine would make
Vim correctness the largest project in the repository — which is not the
product's differentiator. (The original prototype validated a canonical key
sequence and swapped prepared snapshots; that was fine for a demo and could not
scale.)

### Real Vim compiled to WebAssembly

Possible — [vim.wasm](https://github.com/rhysd/vim.wasm) exists — and far more
authentic. The problem is integration, not execution:

- **Rendering.** Vim draws a terminal grid. The app needs semantic ranges,
  DOM-accessible text, custom cursor and selection effects, responsive phone
  layout, large themeable type, and decorations reacting to exact ranges. The
  alternative is building a new Vim GUI from screen-grid events.
- **Instrumentation.** Lessons need the buffer before and after a command,
  mode and submode, the incomplete command, the targeted range, command
  boundaries, register changes, and undo grouping. Native Vim can expose much of
  this, but not as a clean browser lesson API.
- **Cost.** A larger binary and slower cold start, workers and a virtual
  filesystem, harder mobile and IME testing, a second rendering and
  accessibility model, and harder deterministic reset.

Worth it for a browser IDE promising "real Vim". Not for a bite-sized trainer
promising clear lessons and instant feedback.

### Remote Neovim

Authentic and well-specified over RPC, but it needs a server process per
session, puts network latency on every keypress, rules out offline practice, and
turns mobile connectivity failures into editing failures. Right for a hosted
dev environment; wrong for a commute trainer.

### Monaco with monaco-vim

Monaco's own repository says mobile browsers are not supported. It is larger
and more IDE-shaped than small exercise buffers need, harder to style into a
tactile phone game, and `monaco-vim` is another adapter around the same
CodeMirror Vim implementation — no more authentic, and with known issues on
commands that need extra input.

### CodeMirror 5

It ships the historical Vim keymap directly and would have been the shortest
path for a script-only prototype. CodeMirror 6 is the current architecture:
explicit immutable state, observable transactions, decorations and view plugins
for custom visuals, and reconfigurable extensions. The cost is ES modules and a
small build step — hence npm, Vite, and pinned versions in the lockfile, with
everything bundled locally and no runtime CDN. "No framework" stayed a useful
constraint; "no build step at any cost" was not worth owning a Vim emulator.

## Decision matrix

| Option | Vim fidelity | Custom UI | Mobile fit | Instrumentation | Offline | Engineering cost | Decision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Snapshot/canonical prototype | 1 | 5 | 5 | 5 | 5 | 1, unscalable | Prototype only |
| Custom JavaScript Vim | 2 initially | 5 | 5 | 5 | 5 | 5 | Reject |
| CodeMirror 5 Vim | 4 for supported subset | 4 | 4 | 4 | 5 | 2 | Viable but legacy |
| **CodeMirror 6 + `@replit/codemirror-vim`** | **4 for tested subset** | **5** | **4** | **5** | **5** | **3** | **Chosen** |
| Monaco + monaco-vim | 3–4 | 3 | 1 | 4 | 4 | 3 | Reject for mobile |
| Vim compiled to WebAssembly | 5 | 1–2 | 2 | 2 | 4 | 5 | Possible later lab |
| Remote Neovim | 5 | 2 | 2 | 3 | 1 | 5 plus operations | Reject for core |

CodeMirror Vim's fidelity score is limited to the **tested subset**. It does not
become a 4 by assumption; the conformance suite earns it.

## Future option: a Real Vim Lab

Only once the main experience is mature: a separate, clearly labelled,
lazy-loaded mode backed by a maintained Vim WebAssembly build, remote Neovim,
or a future browser-native Neovim, isolated behind the same adapter. It should
replace the primary engine only if it proves equal or better on mobile input,
rendering, accessibility, instrumentation, offline use, startup, and
maintainability.

## Sources

- [CodeMirror 6 system guide](https://codemirror.net/docs/guide/) and [reference manual](https://codemirror.net/docs/ref/)
- [CodeMirror 6 extension catalog](https://codemirror.net/docs/extensions/)
- [CodeMirror 5-to-6 migration guide](https://codemirror.net/docs/migration/)
- [`@replit/codemirror-vim`](https://github.com/replit/codemirror-vim)
- [CodeMirror 5 Vim demo and provenance](https://codemirror.net/5/demo/vim.html)
- [Monaco Editor](https://github.com/microsoft/monaco-editor) and [`monaco-vim`](https://www.npmjs.com/package/monaco-vim)
- [vim.wasm](https://github.com/rhysd/vim.wasm)
- [Vim](https://github.com/vim/vim) and [Neovim](https://github.com/neovim/neovim)
