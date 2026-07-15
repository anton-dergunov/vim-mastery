# Vim Engine Choice

## Decision

Use **CodeMirror 6** as the browser editor and **`@replit/codemirror-vim`** as the primary Vim command engine.

Do not implement the curriculum’s Vim behavior from scratch. Do not embed native Vim or Neovim as the primary runtime. Use native Vim as a **development and conformance oracle**, not as the interface users interact with.

Both guided exercises and Free Practice should initially use the same CodeMirror Vim engine. The product must describe this honestly as the **Vim Wilds supported Vim command set**, not complete Vim or Neovim parity.

Keep the application behind a small engine adapter so that a native Vim/Neovim implementation could be added later as an experimental “Real Vim Lab” without rewriting the lesson UI.

In short:

> CodeMirror owns the document and rendering. CodeMirror Vim interprets Vim commands. Vim Wilds owns lessons, validation, telemetry, hints, animation, and progression. Native Vim verifies behavior in tests.

## Why this is the best fit

The application needs more than a text editor that accepts Vim keys. It must:

- Render readable real code inside a heavily customized mobile interface.
- Accept both the on-screen keyboard and a physical keyboard.
- Expose cursor, selection, document, mode, and command activity to the lesson system.
- Reset exercises deterministically.
- Validate target states independently of one canonical solution.
- Highlight affected ranges while commands are being explained.
- Drive hints, character reactions, sound, animation, and telemetry from editing events.
- Remain responsive and eventually offline-capable.
- Support unrestricted Free Practice without maintaining a second editing implementation.

CodeMirror 6 is designed as a modular browser editor. Its state contains the document and selection, changes are represented as transactions, and extensions can observe or decorate editor behavior. That architecture gives the game a semantic editor surface rather than a terminal-shaped bitmap. See the [CodeMirror system guide](https://codemirror.net/docs/guide/) and [reference manual](https://codemirror.net/docs/ref/).

The maintained [`@replit/codemirror-vim` package](https://github.com/replit/codemirror-vim) supplies Vim bindings for CodeMirror 6. It preserves the older CodeMirror Vim API through `getCM(view)` and exposes operations such as:

- `Vim.handleKey(cm, key)` for programmatic keys.
- `Vim.exitInsertMode(cm)`.
- `Vim.defineEx(...)` for application-specific Ex commands.
- `Vim.map(...)` and `Vim.unmap(...)`.
- `Vim.defineOperator(...)` and the underlying keymap for extensions.

This is exactly the seam needed by the existing touch keyboard and by future lesson instrumentation.

## Important qualification: this is not real Vim

CodeMirror Vim is an emulation layer. It descends from the Vim keymap originally built for CodeMirror 5 and adapted to CodeMirror 6. It implements a large and useful subset of Vim behavior, but it does not run Vim’s C runtime, Vimscript environment, terminal UI, filesystem model, or complete command set.

The product may claim:

- Real editing of a real text buffer.
- Vim-style modal behavior.
- A documented, tested command set.
- Behavior compared against native Vim for the commands the app teaches.

The product must not claim:

- A complete Vim or Neovim emulator.
- Compatibility with arbitrary `.vimrc` files or plugins.
- Complete Ex, Vim regex, scripting, buffer, window, or terminal behavior.
- That every host editor’s Vim plugin behaves identically.

“Real behavior” should mean that every taught command has explicit conformance tests against native Vim—not that a native Vim binary is secretly rendering the exercise.

## Why not implement Vim ourselves?

The present MVP validates a canonical sequence and swaps prepared snapshots. That is appropriate for demonstrating the product, but it does not scale into a general editing engine.

Reimplementing the planned curriculum would require correct handling of:

- Modes and mode transitions.
- Counts and count multiplication.
- Operators, motions, and operator-pending state.
- Inclusive, exclusive, characterwise, linewise, and blockwise ranges.
- Text objects and delimiter edge cases.
- Visual Character, Visual Line, and Visual Block.
- Registers, numbered deletes, yank preservation, and put semantics.
- Undo grouping and dot-repeat.
- Search state, character-find repetition, and matching.
- Marks, jumps, change history, and special positions.
- Macros, replay, failure, nesting, and recorded insertions.
- Command-line ranges.
- Vim regular expressions and substitution replacement semantics.
- `:normal`, `:global`, and their interaction with mappings and ranges.

The difficult part is not implementing `h`, `j`, `k`, `l`, or `dw`. It is preserving the exact interactions between commands. Small differences teach bad habits, especially in an educational product.

A custom engine would provide maximum control over animation and telemetry, but would make Vim correctness the largest engineering project in the repository. That is not the product’s differentiator.

## Why not run real Vim in WebAssembly?

It is technically possible. Projects such as [vim.wasm](https://github.com/rhysd/vim.wasm) compile Vim for the browser. A native or WebAssembly Vim runtime would provide much more authentic command semantics.

The problem is not getting Vim to execute. The problem is integrating it into this game.

### Rendering problem

Vim normally renders a terminal grid: cells, highlights, status lines, messages, popups, and command-line state. The app instead needs:

- Semantic code ranges.
- DOM-accessible text.
- Custom cursor and selection effects.
- Responsive line layout inside a phone game board.
- Large, themeable typography.
- Decorative layers that can react to exact ranges.

Using Vim’s terminal renderer would mean embedding a terminal-like surface, probably through a canvas or terminal component. That would make the custom board easy to place around the terminal, but hard to integrate with the text inside it.

Writing a custom Vim UI is possible by consuming Vim/Neovim screen-grid or RPC events. At that point the project is effectively building a new Vim GUI: handling cell grids, highlights, scrolling, command-line UI, popups, modes, mouse input, IME behavior, and synchronization.

### Instrumentation problem

The lesson system needs to know not just that the screen changed, but:

- The buffer before and after a command.
- The logical cursor and selections.
- Current mode and submode.
- Which command is incomplete.
- What range a motion or operator targets.
- When one logical command is complete.
- Which register changed.
- How undo was grouped.

Native Vim can expose much of this through Vimscript, jobs, RPC, or custom patches, but it is not a clean browser lesson API. A bridge would need to be designed and maintained.

### Product and operational costs

A browser Vim runtime also introduces:

- A larger binary and slower cold start.
- Worker and virtual-filesystem concerns.
- More complicated browser compatibility.
- Difficult mobile and IME testing.
- A second rendering and accessibility model.
- More complex deterministic reset behavior.
- Less direct control over the exercise’s visual composition.
- Additional maintenance when upstream Vim or the WebAssembly port changes.

Those costs might be worthwhile for a browser IDE whose main promise is “real Vim in the browser.” They are not worthwhile for a bite-sized trainer whose main promise is clear lessons, instant feedback, and practical command fluency.

## Why not remote Neovim?

Another technically valid architecture is to run Neovim on a server and attach a browser UI through RPC.

This provides authentic Neovim behavior and a well-defined UI protocol, but it conflicts with the product:

- It requires a backend process or container per active session.
- It introduces network latency into every keypress.
- It prevents fully local, offline practice.
- Session lifecycle and isolation become operational responsibilities.
- Mobile connectivity failures become editing failures.
- Custom rendering and instrumentation are still substantial.

Remote Neovim is suitable for a hosted development environment. It is a poor default for a commute-friendly trainer.

## Why not Monaco plus monaco-vim?

[Monaco](https://github.com/microsoft/monaco-editor) is the editor component derived from VS Code, and [monaco-vim](https://www.npmjs.com/package/monaco-vim) adapts CodeMirror’s Vim implementation to it.

It sounds attractive because the curriculum targets embedded-editor Vim use. It is still the wrong choice here:

- Monaco’s own repository explicitly says mobile browsers and mobile web-app frameworks are not supported.
- Monaco is larger and more IDE-shaped than the small exercise buffers require.
- `monaco-vim` is another adapter around the CodeMirror Vim implementation, so it does not provide more authentic Vim semantics.
- The adapter warns that commands needing extra input, including some Ex and search/replace behavior, may have issues.
- Styling Monaco into a compact, tactile phone game would be harder than styling CodeMirror.

Monaco would be reasonable for a desktop browser IDE. Mobile-first is a decisive reason to prefer CodeMirror.

## Why CodeMirror 6 rather than CodeMirror 5?

CodeMirror 5 includes the historical Vim keymap directly and has a mature imperative API. It would be the shortest path for an old-style script-only prototype.

CodeMirror 6 is the better foundation:

- It is the current modular architecture.
- Document and selection state are explicit and immutable.
- Transactions make edits observable and testable.
- Decorations and view plugins are designed for custom visual behavior.
- State fields and extensions can hold lesson-related UI state cleanly.
- Reconfiguration can switch language, theme, read-only behavior, and lesson extensions.
- The Replit Vim package provides the CM5-compatible Vim API where needed.

The [CodeMirror migration guide](https://codemirror.net/docs/migration/) explains the transaction and extension model.

### Build-system consequence

CodeMirror 6 is distributed as ES modules. Its official guide recommends a bundler or module loader. Adopting it therefore introduces dependency management and a small build step.

The recommended setup is:

- Keep the application framework-free.
- Add npm package management.
- Use Vite or Rollup only to bundle local ES modules and CSS.
- Pin CodeMirror and `@replit/codemirror-vim` versions in the lockfile.
- Bundle dependencies locally; do not depend on a CDN at runtime.
- Preserve the option to produce a static, offline-capable site.

“No framework” remains a useful constraint. “No build step at any cost” should not force the product to own a Vim emulator.

## Recommended architecture

```text
Touch keyboard ─┐
                ├─> Key normalizer ─> VimEngine adapter
Physical keys ──┘                         │
                                         │
                     ┌───────────────────┴───────────────────┐
                     │ CodeMirror 6 + @replit/codemirror-vim │
                     │ document · cursor · selection · undo  │
                     │ modes · motions · operators · macros  │
                     └───────────────────┬───────────────────┘
                                         │ transactions/events
             ┌───────────────────────────┼───────────────────────────┐
             │                           │                           │
       Lesson validator            Command tray              Visual feedback
       target + constraints        mode + keys + hint        ranges + animation
             │                           │                           │
             └───────────────────────────┼───────────────────────────┘
                                         │
                               telemetry/progression
```

### CodeMirror owns

- The text document.
- Cursor and selections.
- Rendering and scrolling.
- Syntax highlighting.
- Undo/redo history.
- Decorations used for teaching overlays.
- Physical-keyboard editor input.

### CodeMirror Vim owns

- Vim modes and transitions.
- Counts.
- Motions and operators.
- Text objects.
- Visual modes.
- Registers and puts.
- Search and repeat behavior.
- Macros and the Ex commands it implements.

### Vim Wilds owns

- Exercise definitions.
- Initial and target states.
- Allowed or required skill constraints.
- Key normalization for the touch keyboard.
- Mode and command display.
- Hint timing and lesson copy.
- Correctness validation.
- Telemetry and proficiency signals.
- Visual and audio reactions.
- Progression and rewards.
- Compatibility documentation.

The application must not reach into CodeMirror Vim internals from many UI components. All such interaction goes through one adapter.

## Engine adapter

The exact TypeScript names may change during implementation, but the boundary should provide these capabilities:

```ts
type VimKey =
  | string
  | "<Esc>"
  | "<CR>"
  | "<BS>"
  | "<Tab>"
  | "<Space>"
  | "<C-v>"
  | "<C-r>";

type VimMode =
  | "normal"
  | "insert"
  | "replace"
  | "visual"
  | "visual-line"
  | "visual-block"
  | "command-line"
  | "operator-pending";

interface EditorSnapshot {
  text: string;
  cursor: number;
  anchor: number;
  head: number;
  mode: VimMode;
}

interface VimEngineEvent {
  kind:
    | "key"
    | "mode"
    | "selection"
    | "change"
    | "command-complete"
    | "search"
    | "error";
  snapshot: EditorSnapshot;
}

interface VimEngine {
  sendKey(key: VimKey): void;
  getSnapshot(): EditorSnapshot;
  subscribe(listener: (event: VimEngineEvent) => void): () => void;
  reset(input: ExerciseEditorState): void;
  focus(): void;
  destroy(): void;
}
```

This is an application interface, not a promise that CodeMirror Vim natively exposes every field. The adapter derives and normalizes the public state needed by lessons.

The UI should depend on `VimEngine`, not directly on `EditorView`, `getCM`, or `Vim`.

## Input pipeline

### Touch keyboard

The current keyboard should emit semantic key tokens rather than synthetic browser keyboard events.

Examples:

| Touch action | Engine key |
| --- | --- |
| Escape | `<Esc>` |
| Enter | `<CR>` |
| Backspace | `<BS>` |
| Ctrl + V | `<C-v>` |
| Shift + 4 | `$` |
| Letter key | `a` through `z`, respecting Shift/Caps behavior |

The adapter converts the token into the representation expected by CodeMirror Vim and sends it through `Vim.handleKey(getCM(view), key)`.

Do not dispatch fake `KeyboardEvent` objects. Browser security, focus, modifier, and layout behavior makes them less reliable than a direct engine call.

### Physical keyboard

Physical input should normally flow through CodeMirror’s own DOM and keymap handling. The adapter observes the resulting Vim and CodeMirror events so touch and physical input produce the same lesson telemetry.

### Native phone keyboard

CodeMirror uses a `contenteditable` surface, so focusing it may open the phone’s native keyboard. The product specifically wants its own physical-style keyboard.

This requires an early mobile spike:

- In virtual-keyboard mode, apply `inputmode="none"` where supported and deliver all touch keys programmatically.
- Prevent pointer interaction with the code surface from unexpectedly summoning the OS keyboard.
- In physical-keyboard mode, restore normal focus and hardware-key handling.
- Test iOS Safari and Android Chromium; do not assume `inputmode="none"` behaves identically.
- Keep selection and accessibility usable when native text input is suppressed.

This is the largest integration risk, but it is smaller than writing a Vim engine.

## Observing state

Use supported public seams:

- `view.state.doc.toString()` for current text.
- `view.state.selection.main` for cursor and primary selection.
- `EditorView.updateListener` for document and selection transactions.
- The CodeMirror Vim compatibility adapter for mode and command signals.
- `getCM(view)` and the public `Vim` API for programmatic keys and defined extensions.

The historical CodeMirror Vim API includes signals such as mode changes, Vim keypresses, and command completion. Since `@replit/codemirror-vim` promises the CM5 Vim extension API, the implementation should verify the exact event behavior in the pinned package and cover it with adapter tests.

Do not couple product logic to undocumented internal objects such as pending operators, register controllers, or parser state unless a missing public hook is first isolated behind the adapter and documented as a maintained patch.

## Exercise validation

The engine migration should change validation from “did the user enter the canonical sequence?” to “did the user produce the required state under the lesson’s constraints?”

### Primary validation

Compare:

- Final text.
- Cursor or selection when the lesson requires it.
- Mode when relevant.
- Optional register contents for register lessons.
- Optional command-family evidence from telemetry.

### Why final state is primary

Vim often has several correct solutions. For example, a target might be reached with a text object, a character-find motion, Visual mode, or substitution. Free practice must permit all supported commands, and later exercises should reward judgment rather than recitation.

### Constraints for introductory lessons

Some lessons specifically teach one capability. They may require:

- Use of a named command family.
- No Insert mode.
- A maximum number of logical commands.
- A particular register.
- Completion with a selection or cursor checkpoint.

These are explicit lesson constraints layered on output validation. They are not hard-coded restrictions inside the Vim engine.

### Canonical solutions

Keep canonical solutions for:

- Hints.
- Demonstrations.
- Efficient-solution comparison.
- Regression tests.

They should not be the only accepted runtime input unless the lesson is explicitly a guided key-by-key introduction.

## Free Practice

Free Practice should use the same engine and renderer as the curriculum.

Benefits:

- Users do not encounter different behavior when leaving a lesson.
- Every engine bug is relevant to both modes and fixed once.
- Theme, keyboard, reference, undo, and recap systems are shared.
- The supported-command boundary remains understandable.
- Free Practice becomes a natural stress test for the engine.

Free Practice removes lesson constraints and target validation. It does not enable untested Vim features or claim complete parity.

Do not initially use “real Vim” only for Free Practice. Two engines would create exactly the wrong discrepancy: a command might work in the sandbox and fail in the lesson that teaches it, or behave differently in cursor placement, registers, regex, or undo.

## Curriculum coverage and gap policy

CodeMirror Vim must be audited against the curriculum rather than assumed complete.

### Likely strong coverage

Verify, but expect good support for:

- Normal and Insert modes.
- Common motions and counts.
- Delete, change, and yank operators.
- Put and common registers.
- Character find and search.
- Text objects.
- Visual Character, Line, and Block.
- Dot-repeat.
- Common marks and jumps.
- Macro recording and replay.
- Basic Ex commands and substitution.

### Areas requiring deliberate conformance work

- Exact Visual Block insert/append behavior.
- Numbered and small-delete registers.
- Clipboard registers on mobile browsers.
- Read-only and expression registers.
- Dot-repeat across insert-mode changes.
- Macro failure and undo grouping.
- Jumplist and changelist semantics.
- `gn`/`gN` and search edge cases.
- Vim regex details such as magic levels, `\zs`, `\ze`, and replacement case conversion.
- Expression replacements.
- Ex address and range semantics.
- `:normal` versus `:normal!`.
- `:global`/`:vglobal` nesting and deletion behavior.
- Formatting operators whose result depends on host configuration.

### Gap policy

For every curriculum command:

1. Add a native-Vim behavior fixture.
2. Run the same scenario through the browser engine.
3. If behavior matches, mark it supported.
4. If the package is close, extend it through a public API or a small maintained patch.
5. If correct support is disproportionately expensive, postpone the lesson or label the difference explicitly.
6. Never silently teach a convenient approximation as Vim behavior.

The package exposes `Vim.defineEx`, mappings, custom keys, and custom operators, so some gaps can be filled without forking. Deeper semantic gaps should be contributed upstream or maintained in a narrowly scoped patch.

## Native Vim as the conformance oracle

The project can gain most of the correctness benefit of real Vim without shipping it.

Create a test harness that:

1. Starts Vim with a clean configuration, such as `-Nu NONE` and no swap file.
2. Loads a deterministic buffer and cursor.
3. Applies a command sequence.
4. Exports text, cursor, mode-relevant state, selections/marks, and registers where needed.
5. Compares the result with the CodeMirror Vim adapter.

Use native Vim fixtures for:

- Every taught primitive command.
- Each combination used by generated exercises.
- Reported engine bugs.
- Advanced regex and Ex behavior.
- Macro and register edge cases.

The conformance suite defines the product’s supported Vim dialect. It is more valuable than claiming that a third-party package is “basically Vim.”

Native Vim should run in development and CI. It does not need to be bundled into the web application.

## Reset and isolation

Exercises must start deterministically.

A reset must define:

- Initial text.
- Cursor and selection.
- Initial mode.
- Undo history.
- Search state.
- Registers required by the lesson.
- Marks or macro state when relevant.

CodeMirror recommends creating a fresh editor state when the whole document and history should be reset. Vim transient state must also be reset through the adapter. If the package does not expose complete reset hooks, destroy and recreate the editor/view for each exercise rather than allowing state to leak.

Free Practice may intentionally preserve registers and search state within one sandbox session. Guided exercises should not inherit them unless the curriculum explicitly creates a multi-step session.

## Styling and rendering

CodeMirror should replace the current token-indexed code snapshot renderer, but it does not need to look like a generic web IDE.

Use:

- `EditorView.theme(...)` and scoped CSS for the code slab/artifact.
- Editor decorations for target previews, affected ranges, search matches, and teaching overlays.
- A custom cursor presentation that remains synchronized with the real selection.
- External DOM layers for Nix, gates, particles, and scenery.
- CodeMirror panels only when they semantically belong to the editor; keep the existing command tray under application control.

Do not manipulate CodeMirror’s internal content DOM directly. Its documentation warns that managed DOM changes will be reconciled away; use decorations, extensions, and view plugins.

Decorative layers must remain `pointer-events: none` and must not change line metrics unless the lesson deliberately demonstrates display-line behavior.

## Rollout strategy

### Phase 0: compatibility spike

Before redesigning the application:

- Create one isolated CodeMirror 6 editor styled to the existing code slab.
- Connect the touch keyboard through `Vim.handleKey`.
- Confirm physical keyboard input.
- Suppress the native phone keyboard in virtual-keyboard mode.
- Observe mode, command, document, cursor, and selection.
- Test on a representative iPhone and Android browser.

Use a deliberately difficult command sample:

- `ci"`
- `2dw`
- `f,` and `;`
- `v`, `V`, and `Ctrl-v`
- Visual Block replace and insert
- Named register yank/put
- Dot-repeat
- Search and `gn`
- Macro record/replay
- `:%s`
- `:normal`
- `:global`

The spike decides package gaps and mobile input behavior, not whether the product should write its own Vim.

### Phase 1: adapter and foundations

- Introduce the `VimEngine` boundary.
- Replace one prototype exercise with live CodeMirror state.
- Preserve the existing keyboard behavior and testing interface.
- Validate output state rather than only canonical keys.
- Add native-Vim fixtures for foundation commands.

### Phase 2: guided lessons

- Add lesson constraints and checkpoints.
- Drive the command tray and hints from adapter events.
- Add affected-range decorations.
- Migrate the eleven prototype exercises.
- Keep snapshot data only as fixtures or demonstrations, not as the runtime editor.

### Phase 3: Free Practice

- Reuse the same engine without target validation.
- Add buffer reset, regeneration, reference, and session recap.
- Publish the tested supported-command matrix.

### Phase 4: advanced automation

- Close conformance gaps for regex, macros, `:normal`, and `:global`.
- Contribute fixes upstream where practical.
- Consider a maintained extension module for Vim Wilds-specific Ex support.

### Phase 5: optional Real Vim Lab

Only after the main experience is mature, evaluate a separate experimental mode backed by:

- A current, maintained Vim WebAssembly build.
- A remote Neovim instance.
- A future browser-native Neovim runtime.

It should be clearly labeled, lazy-loaded, and isolated behind the same engine contract. It should not replace the primary engine unless it proves equal or better on mobile input, rendering, accessibility, instrumentation, offline use, startup, and maintainability.

## Decision matrix

| Option | Vim fidelity | Custom UI | Mobile fit | Instrumentation | Offline | Engineering cost | Decision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Continue snapshot/canonical MVP | 1 | 5 | 5 | 5 | 5 | 1 initially, unscalable | Prototype only |
| Build a custom JavaScript Vim | 2 initially | 5 | 5 | 5 | 5 | 5 | Reject |
| CodeMirror 5 Vim | 4 for supported subset | 4 | 4 | 4 | 5 | 2 | Viable but legacy |
| **CodeMirror 6 + `@replit/codemirror-vim`** | **4 for tested subset** | **5** | **4** | **5** | **5** | **3** | **Choose** |
| Monaco + monaco-vim | 3–4 | 3 | 1 | 4 | 4 | 3 | Reject for mobile |
| Vim compiled to WebAssembly | 5 | 1–2 | 2 | 2 | 4 | 5 | Possible later lab |
| Remote Neovim | 5 | 2 | 2 | 3 | 1 | 5 plus operations | Reject for core |

The fidelity score for CodeMirror Vim is intentionally limited to the **tested subset**. It does not become a 4 by assumption; the conformance suite earns that score.

## Final recommendation

Build the real product around:

1. **CodeMirror 6** for the document, cursor, selection, rendering, undo, accessibility, and decorations.
2. **`@replit/codemirror-vim`** for Vim command interpretation.
3. **A Vim Wilds adapter** for touch keys, normalized state, telemetry, and lesson hooks.
4. **Output-based exercise validation** with explicit pedagogical constraints.
5. **The same engine for guided lessons and Free Practice.**
6. **Native Vim differential tests** for every command the curriculum claims to teach.
7. **An optional native-Vim experiment later**, isolated behind the adapter rather than shaping the MVP.

This approach does not provide perfect Vim “for free.” It provides the best balance:

- Far more authentic and complete behavior than a custom MVP engine.
- Far more control, accessibility, and game integration than an embedded terminal.
- One behavior model across lessons and free editing.
- A credible path to advanced automation commands.
- A migration path if a better native browser engine becomes practical.

## Sources

- [CodeMirror 6 system guide](https://codemirror.net/docs/guide/)
- [CodeMirror 6 reference manual](https://codemirror.net/docs/ref/)
- [CodeMirror 6 extension catalog](https://codemirror.net/docs/extensions/)
- [CodeMirror 5-to-6 migration guide](https://codemirror.net/docs/migration/)
- [`@replit/codemirror-vim` repository and usage](https://github.com/replit/codemirror-vim)
- [CodeMirror 5 Vim demo and provenance](https://codemirror.net/5/demo/vim.html)
- [Monaco Editor repository and mobile-support statement](https://github.com/microsoft/monaco-editor)
- [`monaco-vim` package](https://www.npmjs.com/package/monaco-vim)
- [vim.wasm repository](https://github.com/rhysd/vim.wasm)
- [Official Vim repository](https://github.com/vim/vim)
- [Official Neovim repository](https://github.com/neovim/neovim)
