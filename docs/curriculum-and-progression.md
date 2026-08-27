# Vim Wilds Curriculum and Progression

## Purpose and product decision

Vim Wilds should use a **hybrid spiral curriculum**: a short linear foundation, followed by prerequisite-based skill tracks, followed by recurring integration and maintenance practice. The curriculum is linear where one idea genuinely depends on another, but circular after a skill has been introduced. Finishing a topic means that the learner is ready to use it in mixed practice; it does not mean the topic disappears forever.

This resolves the linear-versus-circular question without forcing either extreme:

- A purely linear course is easy to understand, but completed commands decay and advanced learners must repeat material they already know.
- A purely circular course provides variety, but gives beginners no dependable mental model or sense of direction.
- The hybrid gives beginners a safe route, lets experienced users test out or choose a useful branch, and keeps every learned command alive through focused and mixed practice.

The product teaches Vim primarily as a **portable language for navigating and transforming text inside modern editors**. It prioritizes motions, operators, text objects, search, repeat, registers, visual editing, and deterministic automation. A small optional appendix covers standalone Vim survival, but editor administration, configuration, and plugin ecosystems are not part of the main path.

This specification builds on the opportunity and learning research in [claude.md](./claude.md) and [deep-research-chatgpt.md](./deep-research-chatgpt.md). It does not repeat their market analysis.

## Audience and promise

The curriculum serves three overlapping audiences:

- A beginner who has never used modal editing and needs a dependable route from modes to useful compositions.
- A partial Vim user who knows basic movement and deletion but relies on inefficient repeated keystrokes.
- An experienced editor user who wants focused practice in text objects, registers, regex, macros, and batch automation.

The app promises to improve:

- Recall of commands and command families.
- Understanding of Vim's compositional grammar.
- Recognition of structural targets such as words, quotes, arguments, blocks, lines, and search matches.
- Judgment about which editing tool fits a particular transformation.
- Confidence assembling short, deterministic editing workflows.

Mobile practice can build vocabulary, recall, spatial familiarity, and compositional thinking. It must not claim to replace the tactile, eyes-free muscle memory acquired on a physical keyboard. The app is a trainer for the cognitive layer of Vim and a preparation and retention companion for real-editor use.

## Learning loop

### Bite-sized lesson shape

A normal lesson lasts two to five minutes. Individual exercises should usually take 15–90 seconds.

Each new concept follows the same loop:

1. **Explain:** a short theory card states the goal, command shape, and one contrast with something already known.
2. **Demonstrate:** an animated or stepwise example shows the cursor, affected range, mode, and resulting buffer.
3. **Isolate:** two or three small exercises require the new concept in convenient conditions.
4. **Mix:** one or two exercises combine it with previously learned commands.
5. **Challenge:** a compact real-code task removes most guidance and asks the learner to choose the command.
6. **Revisit:** the skill returns later in mixed review and in harder versions of earlier scenarios.

Theory should explain an editing idea, not present a command dump. For example, a text-object lesson teaches “operate on the contents or the surrounding object” before enumerating every delimiter variant.

### Exercise design rules

- Use code-like buffers by default: calls, object literals, tests, configuration, lists, strings, logs, and small functions.
- Give every guided exercise a deterministic initial buffer, cursor, target state, and teaching solution.
- Introduce one primary idea at a time; mixed exercises may deliberately require several already-known ideas.
- Keep the difficult part aligned with the Vim skill. Do not hide the intended command behind riddles, domain trivia, or maze solving.
- Show the affected motion or text object visually while a command is being composed.
- Prefer meaningful transformations over arbitrary cursor races.
- Teach efficient canonical solutions, while allowing equivalent correct solutions when the eventual execution engine can validate them safely.
- Explain why a solution is useful. Keystroke count is feedback, not the sole definition of quality.
- Use inserted text sparingly on mobile. The practice target is the command grammar, not touchscreen prose entry.

## Progression model

### Four arcs

The visible curriculum has four arcs:

1. **Foundations** is a sequential spine. It establishes modes, movement, editing grammar, search, and text objects.
2. **Fluency tracks** are selectable after their prerequisites are met. They deepen visual editing, registers, navigation, and repeat.
3. **Automation** is an advanced prerequisite graph covering Ex ranges, substitution, regex, macros, `:normal`, and `:global`.
4. **Integration and mastery** combines the earlier skills in realistic work and sustains them indefinitely.

The dependency shape is:

```text
Modal model
    -> movement
    -> basic changes
    -> operator grammar
       -> precision motion and search
          -> text objects
             -> visual selection ------┐
             -> registers and putting -+-> macros -----------┐
             -> repeatable editing ----┘                      |
          -> long-range navigation ---------------------------+-> capstones
       -> Ex ranges -> substitution and regex ----------------+-> global/normal
                                                              |
All completed topics ------------------------------------------+-> mastery loops
```

The map may render this as regions or chapters, but prerequisites—not screen position—define the learning order.

### Conceptual progress states

Every skill can have one of five product-facing states:

- **Unseen:** the concept has not been introduced.
- **Learning:** theory or guided exercises have begun.
- **Practiced:** the learner has completed isolated applications.
- **Integrated:** the learner has used the concept successfully in mixed or capstone work.
- **Maintenance due:** the concept was previously integrated and should be revisited.

These states define the product language and the information the curriculum must expose. They do not define a scoring, decay, scheduling, or knowledge-tracing algorithm. Those mechanics are deliberately deferred.

### Navigation and learner control

The curriculum supports six top-level destinations:

- **Continue:** follow the recommended next lesson on the prerequisite path.
- **Curriculum Map:** inspect every topic, its dependencies, progress state, and available practices.
- **Focused Practice:** repeatedly drill a selected topic or command family.
- **Mixed Review:** combine previously learned topics, including maintenance work.
- **Free Practice:** edit an unrestricted generated buffer using the app's supported command set.
- **Reference:** search commands by key, intent, mode, or object and open examples.

Users choose an initial confidence level: new to Vim, familiar with basics, or experienced. This choice changes the suggested entry point, not content availability. A user may preview any topic, manually request its test-out challenge, or skip it with a visible prerequisite warning. Skipping never permanently locks later material. Exact placement scoring and automatic promotion are future adaptation work.

Completion records first mastery and unlocks appropriate dependents. It never removes the chapter, focused drills, theory, or challenge variants.

## Curriculum command matrix

“Core” means part of the recommended path for practical embedded-editor fluency. “Advanced” means valuable but introduced only after its prerequisites. “Optional” means useful for particular workflows or less consistently portable across host integrations.

### Arc 1 — Foundations: sequential core

| Unit | Commands and concepts | Prerequisites | Learning outcome | Representative exercises | Priority and portability |
| --- | --- | --- | --- | --- | --- |
| 1. The modal model | Normal, Insert, Replace, Operator-pending, Visual Character, Visual Line, Visual Block, Command-line; `Esc`, `Ctrl-[`; cancellation; cursor semantics; `count + operator + motion/text object` | None | Identify the active mode, return safely to Normal mode, and read a composed command as a sentence | Leave Insert mode; cancel a partial operator; predict the range of `2dw`; distinguish a motion from an edit | Core. Hosts may reserve `Ctrl-[`, so `Esc` remains the primary mobile legend |
| 2. Cursor movement | `h j k l`; counts; `0`, `^`, `$`, `g_`, `\|`; `w W e E b B ge gE`; `gg`, `G`; `gj`, `gk` | Unit 1 | Reach characters, words, line boundaries, and buffer boundaries without editing | Move to an identifier, last nonblank character, next WORD, or requested line; compare logical and wrapped display lines | Core. `gj/gk` behavior depends on wrapping, but the distinction is portable |
| 3. Entering and changing text | `i I a A o O`; `x X`; `r R`; `s S`; `J gJ`; `u`, `Ctrl-r`; `~`, `g~`, `gu`, `gU`; `Ctrl-a`, `Ctrl-x` | Units 1–2 | Choose a precise entry/change command, undo safely, and perform common local transformations | Append an argument; open a line; replace a delimiter; join a wrapped statement; change case; increment a version number | Core, with `R`, `gJ`, and numeric changes introduced after the everyday commands |
| 4. Operator grammar | `d c y`; `dd cc yy`; `D C Y`; `p P`; counts before operators or motions; linewise vs characterwise ranges; `> < =`; `gq gw`; `.` | Units 1–3 | Compose operators with motions, predict the affected range, put text, and make a change deliberately repeatable | Delete two words; change to line end; duplicate a line; indent a block by motion; reflow a paragraph; repeat a prepared change | Core. Host formatting may affect `=` and `gq`, so exercises use deterministic app behavior |
| 5. Precision motions and search | `f F t T ; ,`; `/ ? n N`; `* # g* g#`; `gn gN`; `%`; `(`, `)`, `{`, `}` | Units 1–4 | Select the smallest reliable motion for nearby punctuation, repeated text, matching delimiters, sentences, and paragraphs | Delete until a quote; repeat a comma find; change the next search match; jump between brackets; move by paragraphs in prose or comments | Core. Search and pair matching remain text-based rather than IDE-semantic |
| 6. Text objects | `iw aw iW aW`; `i" a"`, `i' a'`, ``i` a` ``; `i( a(`, `i) a)`, `ib ab`; `i[ a[`, `i] a]`; `i{ a{`, `i} a}`, `iB aB`; `i< a<`, `i> a>`; `is as`, `ip ap`, `it at` | Units 1–5 | Choose inside versus around and apply any learned operator to a structural object | Change a quoted value; delete function arguments; yank an object literal; uppercase a word; indent a paragraph; replace tag contents | Core. Tag and angle-bracket objects are exercised only where the buffer makes their boundaries unambiguous |

#### Foundation teaching sequence

The first four units should be tightly sequential. Unit 5 begins precision and retrieval; Unit 6 demonstrates why the earlier grammar matters. The learner should leave Arc 1 able to understand an unfamiliar composition such as `gUip` even if that exact sequence was never memorized.

Counts are introduced in movement, reused in basic changes, and formalized with operators. The app should show that counts can multiply (`2d3w`), but ordinary exercises should favor the clearest count placement rather than rewarding obscure golf.

Dot-repeat is introduced in Unit 4 because it changes how edits should be designed. Unit 10 later turns that basic capability into a deliberate workflow.

### Arc 2 — Fluency tracks

| Unit | Commands and concepts | Prerequisites | Learning outcome | Representative exercises | Priority and portability |
| --- | --- | --- | --- | --- | --- |
| 7. Visual selection | `v`, `V`, `Ctrl-v`; `o`, `O`; `gv`; selection operations `d c y x r ~ u U > < = gq`; Visual Block `I A c d x r` | Units 1–6 | Select character, line, and rectangular ranges; modify them; and decide when selection is clearer than operator-motion | Indent lines; replace a column marker; prepend text to several rows; reselect and correct the last selection | Core. `Ctrl-v` is semantically important even when a host reserves that chord; the app teaches Vim behavior |
| 8. Registers and putting | Unnamed `""`; yank `"0`; numbered `"1`–`"9`; named `"a`–`"z`; append with `"A`–`"Z`; black-hole `"_`; small delete `"-`; clipboard `"+`; `p P gp gP`; `:registers` as inspection | Units 1–6, especially `y d c p` | Preserve yanks, select storage deliberately, reuse multiple snippets, and understand why delete/change affects later puts | Delete without overwriting a yank; paste the previous yank after another edit; collect lines into a named register; choose where to put text and where the cursor should land | Core through named and black-hole registers. The useful but host-dependent `"+` clipboard is emulated inside each Vim Wilds exercise and never touches the device clipboard |
| 9. Long-range navigation | `H M L`; `zt zz zb`; `Ctrl-f`, `Ctrl-b`, `Ctrl-d`, `Ctrl-u`, `Ctrl-e`, `Ctrl-y`; `m{char}`; `'` and backtick jumps; special marks such as `'.`, ```.```, `'^`, ```^```, `'[`, `']`; `Ctrl-o`, `Ctrl-i`; `g;`, `g,`; `gi`, `gv`; advanced bracket/section motions | Units 1–6 | Move through a large edit without losing important locations, and return to prior jumps, changes, insertions, or selections | Inspect a distant definition and return; revisit the last change; center a target line; mark two sites and shuttle between them | Core through marks, jump/change lists, and viewport commands. Code-section motions are advanced and syntax-dependent |
| 10. Repeatable editing | Deliberate `.`, `;`/`,` plus `.`, `n`/`N` plus `.`, `@:`, `&`, `:~`; count vs repeat; repeat-friendly cursor placement | Units 1–6; Unit 8 recommended | Design one change that can be replayed across nearby or searched instances, and recognize when repeat is the wrong tool | Change one field and repeat on later rows; search for a token and apply the same edit; compare `3dd` with repeated `dd`; rerun a recent Ex change | Core. `@:`, `&`, and `:~` bridge into Arc 3 and appear only after basic Command-line use |

These tracks may be studied in any order after Arc 1, subject to the prerequisites shown. Registers and repeat should be recommended before macros. Visual selection should be recommended before column automation. Long-range navigation should be recommended before capstones involving larger buffers.

### Arc 3 — Automation

| Unit | Commands and concepts | Prerequisites | Learning outcome | Representative exercises | Priority and portability |
| --- | --- | --- | --- | --- | --- |
| 11. Command-line ranges and line operations | `:`; addresses `.`, `$`, numbers, marks, search addresses; `%`; ranges with `,` and `;`; offsets; visual range `'<,'>`; `:delete`, `:yank`, `:put`, `:copy`/`:t`, `:move`/`:m`, `:join`, `:sort`; safe undo and preview habits | Units 1–6 | Read and construct a range, then apply a deterministic line operation to it | Move a helper below another function; copy a fixture; delete matching line numbers; sort selected imports; join a range | Core automation. Command availability and undo grouping can vary in reimplementations, so the app defines and tests its supported behavior |
| 12. Substitution and practical regex | `:s/pattern/replacement/flags`; line, numeric, visual, and `%` ranges; flags `g c i I n`; empty/reused pattern or replacement; alternate delimiters; `. * \+ \? \{m,n}`; `^ $`; classes and negation; Vim classes such as `\d`, `\w`, `\s`; groups `\(…\)`; alternation `\|`; word boundaries `\< \>`; captures; `\zs \ze`; very magic `\v`; replacement `&`, `\0`–`\9`, `\r`, case conversion, and `\=` expressions | Unit 5 search; Unit 11 ranges | Perform safe local and buffer-wide substitutions, capture structure, preview impact, and know when regex is too brittle | Rename exact tokens; swap captured fields; edit only part of a match; normalize declarations; confirm replacements; count matches without changing them | Core through captures and confirmation. `\zs`, `\ze`, case conversion, and expression replacement are advanced |
| 13. Macros | `q{register}…q`; `@{register}`; `@@`; counts such as `10@a`; append with `qA`; inspect, put, and edit macro text; stable anchors; deliberate final cursor position; stopping on failed motion/search; optional recursion | Units 4, 5, 8, and 10 | Record a robust transformation, replay it safely, inspect or repair it, and state the assumptions that make it valid | Comment irregular calls; restructure repeated object entries; record on one row and apply to selected instances; repair a macro with a bad final motion | Core automation. Recursive macros are optional and never required for normal progression |
| 14. Global and Normal automation | `:normal`, `:normal!`; range and visual application; `:global`/`:g`; `:vglobal`/`:v`; global delete, substitute, normal commands, and macros; `:copy`/`:move` relocation by predicate; previewing a predicate before it runs; undo grouping; combined predicates and transformations | Units 11–13 | Apply Normal-mode edits across a controlled line set, relocate matching lines, and choose the lowest-risk automation mechanism | Run a text-object edit on selected lines; delete debug lines; modify only declarations matching a predicate; execute a macro over matches; gather matching lines at a chosen address | Core advanced automation. The distinction between mapped and unmapped Normal commands is explained, while mappings themselves stay out of scope |

#### Practical regex boundary

The curriculum teaches enough Vim regex to perform dependable code and text transformations; it is not a general regex course. Exercises should progress from literal substitutions to classes, captures, boundaries, and scoped matches. Expression replacement is a final advanced lesson because it crosses from command composition into small-program behavior.

#### Automation decision framework

Arc 3 culminates in choosing a tool, not blindly preferring the most advanced command:

| Situation | Preferred starting tool |
| --- | --- |
| One local structural edit | Operator plus motion or text object |
| A small fixed number of adjacent items | Count or Visual selection |
| The same nearby change repeated after movement | Dot-repeat |
| A rectangular column transformation | Visual Block |
| A textual pattern with a clear replacement | `:substitute` |
| A multi-step edit repeated over differing local structure | Macro |
| The same Normal command on a known line range | `:normal` |
| A line-predicated delete or transformation | `:global` or `:vglobal` |
| A semantic, cross-file, judgment-heavy transformation | Host refactor, external script, or another semantic tool |

Exercises should sometimes ask the learner to select the mechanism before entering keys. An advanced command is not automatically the best command.

### Arc 4 — Integration and lifelong practice

#### Unit 15: real-code workflow capstones

Capstones combine skills without introducing new command families. Each capstone should have a small buffer, an explicit target, and several meaningful stages.

1. **Function calls and arguments**
   - Change, delete, copy, and reorder arguments with motions and delimiter text objects.
   - Combine search, registers, and repeat across several calls.

2. **Strings and identifiers**
   - Change quoted values, operate on words with punctuation, and repeat a rename-like local edit.
   - Contrast text substitution with structural text-object changes.

3. **Formatting and indentation**
   - Indent blocks, reflow comments, join or split prepared lines, and normalize case or numeric sequences.

4. **Irregular repeated structures**
   - Build macros around anchors rather than absolute columns.
   - Detect an instance that violates the macro's assumptions and stop safely.

5. **Search-driven cleanup**
   - Navigate matches, change them with `gn`, then compare the workflow with a confirming substitution.

6. **Register-preserving refactors**
   - Move two distinct snippets while protecting the original yank from intervening deletions.

7. **Predicate-based batch editing**
   - Combine ranges, `:global`, `:normal`, substitutions, or a macro to edit only qualifying lines.

8. **Review and surgical correction**
   - Navigate a larger generated code sample, mark important sites, inspect changes, and make several small corrections without losing context.

Capstones should include a short explanation of why the teaching solution was selected. Alternate valid solutions may be compared by clarity, setup cost, repeatability, and risk rather than keystroke count alone.

#### Unit 16: mastery loops

Mastery is ongoing use of a stable curriculum, not an endless stream of nominally new levels.

- **Focused drills** keep every topic directly replayable and allow a user to pin commands or concepts.
- **Mixed sessions** interleave two to five learned families so the user must retrieve and select a method.
- **Maintenance sessions** resurface previously integrated concepts. The scheduling rule is future work.
- **Advanced variants** increase buffer size, reduce hints, vary cursor placement, add distractors, or require several compositions.
- **Tool-choice challenges** present a transformation before revealing which family is expected.
- **Endless generated challenges** vary content and context while drawing only from validated skill templates.
- **Personal focus lists** let users declare what they want to practice regardless of the recommended queue.

Review should revisit ideas at deeper levels:

1. Recall a command with explicit guidance.
2. Apply it in isolation.
3. Distinguish it from a plausible alternative.
4. Compose it with older commands.
5. Select it independently in realistic code.
6. Use it as a building block in automation.

This progression creates “advanced levels of the same concept” without duplicating chapters or pretending a completed skill is permanently finished.

## Free practice

Free Practice is always callable from the primary navigation, including before the learner begins the curriculum. It is a playground, not the main progression path and not a gated reward.

### Session setup

The user may choose:

- Code or prose.
- A supported language or neutral text.
- Small, medium, or large buffer.
- Optional theme such as strings, functions, logs, structured data, or prose.
- Optional command-family emphasis.
- Goal-free editing or lightweight edit prompts.

Defaults should open a small generated code buffer immediately. Setup must not become a barrier to a spare-minute session.

### Behavior

- Every command implemented for the practical curriculum is available whether or not the corresponding lesson is unlocked.
- The app labels this as the **Vim Wilds supported command set**, not complete Vim or Neovim compatibility.
- There is no canonical solution in goal-free mode.
- Undo, reset, generate another buffer, open command reference, and leave the session are always available.
- Optional prompts suggest transformations but may be dismissed permanently for that session.
- An optional recap may show commands used, modes entered, repeated manual patterns, and relevant focused drills.
- Free-practice activity never lowers progression, consumes a review opportunity, or blocks curriculum advancement.
- Generated material must be local/offline-capable and must not depend on an LLM to define correct Vim behavior.

Focused Practice remains a separate mode. It has a named learning objective, controlled starting state, and feedback. Free Practice gives the learner ownership of the buffer and does not judge what they intended to do.

## Curriculum data required for future adaptation

Adaptation mechanics are out of scope, but the curriculum should be authored so they can be added without rewriting its structure. Each lesson or exercise should eventually expose:

- Stable skill and exercise identifiers.
- Commands and command families exercised.
- Required prerequisite skills.
- Primary skill versus supporting skills.
- Modes entered.
- Motion or text-object targets.
- Difficulty dimensions such as buffer size, cursor distance, hint level, distractors, and composition length.
- Initial buffer, target buffer when applicable, and accepted/canonical sequence metadata.
- Whether the task measures recall, application, discrimination, composition, tool choice, or automation.
- Portability notes for behavior that may differ in host integrations.

This is a curriculum contract, not a proposed schema or learner model. Proficiency formulas, forgetting curves, review intervals, telemetry, and next-exercise selection policies will be designed separately.

## Mapping the current prototype

The current eleven exercises are useful examples of visual presentation and advanced commands, but their order is not a viable beginner progression. They should be mapped into the curriculum as follows:

| Prototype exercise | Primary curriculum location | Foundations it assumes | Future role |
| --- | --- | --- | --- |
| `rune-column` | Unit 7, Visual Block | Modes, `j`, counts, selection, `r` | Guided Visual Block replace exercise after Visual modes are introduced |
| `crystal-string` | Unit 6, quote text objects | Insert/Normal transitions, `c`, inside/around semantics | Early text-object change exercise |
| `empty-altar` | Unit 6, delimiter text objects | Operator grammar and parentheses boundaries | Introductory `di(` exercise |
| `debug-thorns` | Unit 4, counts plus line operators | Counts and `dd` | Foundation mixed exercise |
| `mirror-repeat` | Unit 10, repeatable editing | `ciw`, Insert/Normal transition, `j`, dot-repeat | Core repeat workflow after text objects |
| `beacon-macro` | Unit 13, macros | `I`, Insert/Normal transition, registers, movement, repeat concepts | First guided record-and-replay macro |
| `terminal-substitute` | Unit 12, substitution | Command-line mode, `%` range, substitute syntax | First whole-buffer literal substitution |
| `bridge-indent` | Unit 7, Visual Line | Visual mode, `j`, indent operator | Introductory line-selection transformation |
| `join-aqueduct` | Unit 3, basic changes | Normal mode and uppercase command entry | Early local-edit exercise for `J` |
| `cut-vine` | Unit 5 plus Unit 4 | `f`, operator-pending mode, `t`, delete | Mixed precision-motion exercise |
| `echo-test` | Unit 8 plus Unit 4 | `yy`, linewise registers, `p` | Bridge from basic yank/put to register concepts |

No exercise-specific runtime branch or existing prototype sequence should define the eventual curriculum. These scenarios may be retained, rewritten, or replaced according to the lesson rules above.

## Optional standalone Vim survival

This appendix is deliberately small and separate from the main progression. It exists for learners who occasionally open Vim directly, not to turn the product into a complete standalone-editor course.

### Help and leaving safely

- Open help with `:help` or `:help {topic}`.
- Follow and return from help tags with `Ctrl-]` and `Ctrl-t`.
- Write with `:w`; quit with `:q`; write and quit with `:x`.
- Use `ZZ` to write and quit and `ZQ` to quit without writing.
- Explain modified-buffer errors and when forced forms such as `:q!` are destructive.

### Files and buffers

- Open or reload a file with `:e`.
- Inspect buffers with `:ls`.
- Switch with `:b {name-or-number}` and remove a buffer with `:bd`.
- Explain that a buffer, file, window, and tab page are different concepts.

### Windows

- Create splits with `:split` and `:vsplit`.
- Move using `Ctrl-w h/j/k/l` or `Ctrl-w` plus an arrow key.
- Close a window with `Ctrl-w c` and keep only the current window with `Ctrl-w o`.

### Orientation only

Tabs, folds, shell commands and filters, the quickfix list, argument lists, and multi-file commands such as `:argdo`, `:bufdo`, `:cdo`, and `:cfdo` receive a short explanation and reference links, but no required progression exercises. Their usefulness and behavior depend more heavily on the surrounding editor workflow.

## Explicit exclusions

The practical curriculum does not teach:

- Vimscript, Lua configuration, mappings, autocommands, or plugin management.
- Particular IDE shortcuts, extension configuration, or host-specific emulation bugs.
- LSP, debugger, test-runner, source-control, file-explorer, or multi-cursor workflows.
- Deep standalone window, tab, buffer, session, or file administration.
- Insert-mode completion, abbreviations, digraphs, or editor-specific text entry systems.
- Exhaustive Ex commands, legacy compatibility behavior, or obscure commands included only for reference completeness.
- A general regex curriculum beyond practical Vim search and substitution.
- Semantic refactoring that requires language understanding rather than deterministic text manipulation.

Common plugin-provided operations such as surround and commentary may inspire exercise content later, but they are not represented as native Vim commands in this curriculum.

## Editorial acceptance criteria

This curriculum is ready to guide product and content design when:

- Every major transferable family—modes, motions, counts, operators, text objects, Visual modes, registers, repeat, search, navigation history, Ex ranges, substitution, regex, macros, `:normal`, and `:global`—has an explicit location and prerequisite.
- A beginner can follow Units 1–6 without relying on commands that have not been introduced.
- Experienced users can preview, test out, skip, and focus on topics without dismantling the prerequisite recommendations.
- Chapter completion and long-term mastery are visibly different concepts.
- Every completed topic remains directly replayable and eligible for mixed practice.
- Free Practice is always accessible and makes an honest compatibility promise.
- Exercises emphasize real editing decisions rather than unrelated puzzle solving.
- Automation lessons teach when not to use automation as well as how to use it.
- Adaptation is supported by stable curriculum concepts but no unchosen scoring or scheduling mechanism is presented as settled.
- Embedded-editor usefulness dominates, while standalone Vim remains a compact optional appendix.
