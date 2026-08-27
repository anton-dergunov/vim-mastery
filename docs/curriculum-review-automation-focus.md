# Curriculum review: units, topics, and exercises

A content-level review pass over the whole authored curriculum, read against the
stated product purpose: **Vim as an automation tool for someone who edits inside
VS Code and occasionally drives Vim from the command line.**

Scope of the pass: `content/unit-index.json`, all fourteen unit files —
**116 lessons, 744 activities, 362 exercises** — plus `supported-commands.json`,
`patches/README.md`, and [curriculum-and-progression.md](./curriculum-and-progression.md).
Exercise-level claims below are derived from the authored `script.commandGroups`
and `scenario` data, not from spot reading.

This document records observations and recommendations only. It changes no unit
file. The execution plan derived from it lives in
[implementation/README.md](./implementation/README.md).

---

## Part 0 — Summary judgment

The curriculum is genuinely good, and two things deserve credit before the
critique:

- **Instruction discipline is perfect.** Zero of 362 exercise instructions leak
  the key sequence (checked for inline command markup). The
  outcome-not-keystroke rule from `IMPROVEMENTS.md` is fully honored.
- **The grammar-first spine is right.** Modes → motions → operators → text
  objects → objects-as-ranges is the correct order, and the
  `explain / demonstrate / isolate / mix / challenge` coverage contract is
  applied consistently across every unit.

Five problems are worth acting on, in descending order of importance:

1. **The retention and integration layer does not exist.** `unit-index.json`
   stops at Unit 14. Units 15 (capstones) and 16 (mastery loops) are specified
   in the curriculum doc and have no content. For an automation-motivated
   learner this is the costliest gap — automation *judgment* forms by repeatedly
   choosing between mechanisms on realistic buffers, which is what capstones do
   and what isolated unit lessons cannot.
2. **Automation is taught at a scale where automation loses.** Units 11–14
   average 4.0–4.8-line buffers. `:g/TODO/normal I// ` on a 3-line buffer costs
   more keystrokes than doing it by hand. This is *not* a conflict with the
   phone-first constraint: the schema already separates buffer length from
   visible rows, and Unit 9 ships 30-line buffers on a phone today. See
   [Part 3](#part-3--exercise-level-findings).
3. **The `challenge` phase frequently repeats the `isolate` phase verbatim.**
   Roughly 30 exercises are exact keystroke duplicates of another exercise in
   the same unit, several of them spanning isolate → mix → challenge. Difficulty
   escalation is nominal in those lessons.
4. **The command-line / multi-file half of the stated goal is absent.** No
   `:argdo`, `:bufdo`, quickfix, `vim -c`, or `ex -sc` anywhere.
5. **About 10 lessons are spent on material rare in both target environments**,
   while ~7 high-leverage automation topics are missing. These nearly cancel:
   this can be a re-balance, not a net expansion.

Arc balance today: Arc 1 = 47 lessons (40%), Arc 2 = 37 (32%), Arc 3 = 32 (28%).
An automation-motivated learner passes 84 lessons before reaching `:global`.
That ordering is pedagogically correct and should not change, but it makes the
**test-out / preview path a core feature rather than polish** for this audience.

---

## Part 1 — Unit-by-unit critique

Units are graded on fit-for-purpose. "Fine as is" means no action needed.

| Unit | Verdict | Principal issue |
| --- | --- | --- |
| 1. The modal model | **Fine as is** | Correctly conceptual; 10 choice activities is the right instinct here. |
| 2. Cursor movement | **Fine as is** | Well-formed. `gj`/`gk` is arguably over-served but it is one lesson. |
| 3. Entering and changing text | **Needs treatment** | Missing Insert-mode command keys; `R` over-weighted. |
| 4. Operator grammar | **Minor** | `gq`/`gw` is a core-path lesson that is inert under VS Code defaults. |
| 5. Precision motions and search | **Needs treatment** | Search is never composed with an operator; sentence motions over-served. |
| 6. Text objects | **Minor** | Strong unit; angle-bracket lesson is redundant, some duplicate canonicals. |
| 7. Visual selection | **Needs treatment** | Structural outlier: zero challenge *exercises*; 5 duplicate canonical pairs; missing block `$`. |
| 8. Registers and putting | **Needs treatment** | Registers are never used from Insert mode — the most common real use is absent. |
| 9. Long-range navigation | **Needs treatment** | Largest unit (11 lessons, 393 KB); ~4 lessons of low-yield, host-blocked material. |
| 10. Repeatable editing | **Minor** | Teaches the older `n .` idiom as primary; one canonical contradicts its own lesson. |
| 11. Command-line ranges | **Fine as is** | Best-constructed unit in Arc 3. Genuinely varied addresses. Missing `:sort n`/`u`. |
| 12. Substitution and regex | **Minor** | Well-sequenced. Buffers too small to make `%` ranges feel meaningful. |
| 13. Macros | **Needs significant treatment** | Macros are taught exclusively on the one case where macros are the *wrong* tool. |
| 14. Global and Normal automation | **Needs treatment** | Buffer scale defeats the lesson; missing the `:g` collect/reorder family. |

### Notes on the units marked "needs treatment"

**Unit 5 — search never becomes a range.** The unit teaches search as
*navigation* (`/`, `?`, `n`, `N`) and `gn` as a *match object*, but never
`d/pattern⏎`. That composition is the insight that folds search into the
operator grammar, and it is the direct conceptual precursor to Ex search
addresses in Unit 11 (`:/obsolete/delete`) and predicates in Unit 14. Unit 11
uses search addresses without the learner ever having used a search as a range.
The bridge is missing.

**Unit 7 — a structural outlier.** Every other unit uses exactly one `choice`
activity. Unit 7 uses nine, and has **zero challenge-phase exercises**
(9 isolate, 19 mix, 0 challenge). Its entire challenge phase is multiple-choice.
Visual selection is the most tactile skill in the curriculum, and it is the one
unit that never asks the learner to *perform* a challenge edit. This looks like
an authoring inconsistency rather than a decision. It also carries five pairs of
exactly duplicated canonical sequences (see Part 3).

**Unit 8 — registers stop at the mode boundary.** Every put in the unit happens
from Normal mode. The most common real-world register use — storing a value and
typing it into a new string with `Ctrl-r0` from Insert mode — never appears.
`Ctrl-r` occurs in the corpus only as redo, in Unit 3. This is the difference
between a learner who understands registers and one who uses them.

**Unit 9 — largest unit, lowest average yield.** 11 lessons and 393 KB, 78%
larger than the next file. Its 30-line buffers are correct and are proof the
platform handles scale. But roughly four lessons cover material that is either
syntax-dependent and unreliable in emulators (`[[ ]] [] ][ [m ]m [M ]M`) or
bound away by the primary target host (`Ctrl-f` = Find, `Ctrl-b` = sidebar,
`Ctrl-e` = quick open, `Ctrl-y` = redo in VS Code defaults). Meanwhile the
high-value half — marks, jumplist, changelist, `gi`, `gv` — shares the chapter
with them. Consider splitting along the natural seam: *viewport control* versus
*position memory*. The second is far more valuable than the first.

**Unit 13 — macros taught on their worst use case.** Every one of the 24 macro
exercises is a **single-line uniform transformation** over adjacent lines. The
curriculum's own decision framework says a macro is for "a multi-step edit
repeated over differing local structure" — and says `:normal` is the right tool
for "the same Normal command on a known line range". Not one Unit 13 exercise
has differing local structure. So the unit consistently demonstrates macros on
precisely the case where Unit 14 will later, correctly, tell the learner to use
`:normal` instead. This is the sharpest content-level contradiction in the
curriculum.

The repetition compounds it: `final-go-fields`, `final-php-records`, and
`final-prose-labels` are the **identical** sequence `qa 0 f: r= j q 3@a` at the
isolate, mix, and challenge phases respectively. The escalation is a language
reskin. `append-csharp-fields` and `append-xml-attributes` are likewise
identical. The "stable anchors" lesson intends to teach structural anchoring,
but `0f:` is the answer nearly every time, so the learner pattern-matches a
skeleton instead of analyzing structure.

**Unit 14 — the scale problem in its purest form.** Buffers are 3–7 lines, most
commonly 3. `:g/TODO/normal I// ` over a 3-line buffer with two matches is
strictly more work than `I// ` `j` `.`. The learner is asked to take on faith
that this scales, at the exact moment the evidence in front of them says
otherwise.

---

## Part 2 — Missing topics

Ranked by automation leverage per unit of authoring cost. "Engine status" refers
to `supported-commands.json` and to greps across all unit content.

### Tier 1 — should be added

| # | Topic | Suggested home | Why it matters | Engine status |
| --- | --- | --- | --- | --- |
| 1 | **Insert-mode command keys**: `Ctrl-r{reg}`, `Ctrl-o`, `Ctrl-w`, `Ctrl-u` | New lesson in Unit 3 (`Ctrl-w`/`Ctrl-u`/`Ctrl-o`); new lesson in Unit 8 (`Ctrl-r0`, `Ctrl-r"`, `Ctrl-ra`) | Where registers become useful daily. `Ctrl-o` is the mode bridge that keeps one long insert from becoming three commands. | `Ctrl-r` present **only as redo**; `Ctrl-o` **only as jumplist**. Needs verification, possibly a patch. |
| 2 | **Search as an operator range** + offsets: `d/pat⏎`, `y/pat⏎`, `d/pat/e⏎` | Unit 5, extending `search-explicit-patterns` | Closes the gap described above and prepares Ex search addresses. | Absent. Search motions verified; operator-pending pairing needs a fixture. |
| 3 | **Read-only registers** `".` `":` `"/` `"%`, and `Ctrl-r/` inside `:` | Unit 8, merged with demoted numbered-register material | `:%s/‹Ctrl-r›//new/g` — reuse the pattern you just confirmed with `/`. Removes the retyping step where substitutions actually go wrong. Also completes `@:` from Unit 10. | Engine `validRegisters` already includes `.`, `:`, `/`. Low risk. |
| 4 | **`:global` collect and reorder**: `:g/pat/t$`, `:g/pat/m0`, `:g/pat/m$` | Unit 14 | Unit 14 covers `:g` with delete, substitute, normal, and macro — never with `:copy`/`:move`. That is the family that gathers every matching line to the end or reverses a file, and it is the most striking thing `:global` does. | **Cheapest item here**: `:g`, `:t`, `:m` all already verified. Pure composition. |
| 5 | **`g Ctrl-a` over a Visual selection** (identical numbers → a sequence) | Unit 7 `edit-rectangular-columns` | Renumbering after a reorder is frequent, fully deterministic, and has no clean non-Vim equivalent. Unit 3 teaches `Ctrl-a` on one number and stops. | Absent. Likely a patch candidate; payoff justifies it. |
| 6 | **Visual Block `$` — the ragged right edge**: `Ctrl-v}$A;⏎` | Unit 7 `insert-across-rows` | Unit 7 only ever teaches aligned rectangles, so the learner concludes Visual Block works only on tables. Appending to lines of differing length is the canonical real use. | Absent. Same code path as the already-patched block `I`/`A`. |
| 7 | **`:sort n`, `:sort u`, `:sort /pat/`** | Unit 11 `join-and-sort-ranges` | Numeric sort and dedupe are the two variants people actually reach for. | `:sort`/`:sort!` verified; flags need a fixture. |

### Tier 2 — worth adding

| # | Topic | Home | Note |
| --- | --- | --- | --- |
| 8 | **`cgn` + `.` as the default sweep** | Unit 10 | `cgn` is taught in Unit 5, but Unit 10 teaches the older `n .` idiom as primary. `cgn` + `.` is strictly safer — it carries the match into the change, so it does not depend on cursor landing. Unit 10 should contrast three tools for one job: `n.`, `cgn` + `...`, and `:%s//…/gc`. That comparison *is* the lesson. |
| 9 | **Undo grouping under automation** | Unit 14 `choose-automation` | One `u` undoes an entire `:g` run; a macro replayed ten times needs ten undos. Learners discover this expensively. Theory + choice; no engine work. |
| 10 | **Dry-run habits for `:global`** | Unit 14 | Unit 12 already teaches `:s///gn` to count before editing — an excellent habit. The same for `:g` (`:g/pat/p`, `:g/pat/nu`) is missing, and `:g` is the more dangerous command. |
| 11 | **Counted insert / open**: `3i-⏎`, `5o⏎` | Unit 3 or Unit 4 | Cheap generator; reinforces that counts apply to Insert commands, which is non-obvious. |

### Tier 3 — reference only, no lessons

`q:` command-line window · filters `!{motion}cmd`, `:%!sort`, `:r !cmd` ·
`:earlier` / `:later` · `"*` vs `"+` · `:s` case conversion `\u \U \E`
(already listed as pending in `supported-commands.json`).

---

## Part 3 — Exercise-level findings

### 3.1 Buffer scale defeats the automation arc

Measured average and maximum initial buffer length, by unit:

| Unit | Avg lines | Max lines | Comment |
| --- | --- | --- | --- |
| 3 Entering/changing | 1.4 | 4 | Fine — local edits |
| 6 Text objects | 1.2 | 4 | Fine, except `ip`/`ap` and `it`/`at` (see 3.4) |
| 9 Long-range nav | **30.0** | 30 | Correct, and proof the platform handles scale |
| 11 Ex ranges | 4.5 | 6 | Tolerable — line ops stay legible small |
| 12 Substitution | 2.1 | 4 | **Too small** — `%` range vs line range is indistinguishable at 2 lines |
| 13 Macros | 4.8 | 12 | **Too small** — `3@a` on 5 lines does not motivate a macro |
| 14 `:global` | 4.0 | 7 | **Far too small** — `:g` loses to hand-editing at this scale |

**This finding does not ask for more visible rows.** The content schema already
separates the two concepts: `scenario.initial.lines` is the whole buffer, and
`scenario.initial.viewport` (`topLine`/`bottomLine`) is the visible window.
**51 activities use it — every one of them in Unit 9**, which ships 30-line
buffers on a phone today. The automation units simply never adopted the
mechanism Unit 9 proved. This is a content gap, not a platform limit, and no
change to the phone layout is implied.

**Recommendation:** automation-unit buffers of **16–24 lines** with **5–9
matches that are non-adjacent and interleaved with non-matching lines**, with
`viewport` holding the visible window at whatever the phone already shows.

Adjacency matters as much as count: if matches are contiguous, `V3j:normal` or
plain `3.` wins and `:g` still looks pointless. **The predicate has to do work
that position cannot do.**

The one genuinely new piece of platform work is a way to perceive effects
outside the window — an impact readout (`7 fewer lines`, which real Vim prints
anyway) and a one-character match-map gutter marking off-screen matches. Without
those, a scattered-match exercise reads as arbitrary through a seven-row window.

This change would do more for the automation arc than any new command.

### 3.2 Duplicate canonical sequences

Exercises with byte-identical canonical key sequences inside the same unit:

| Unit | Sequence | Exercises | Phases spanned |
| --- | --- | --- | --- |
| 13 | `qa 0 f: r= j q 3@a` | `final-go-fields`, `final-php-records`, `final-prose-labels` | **isolate → mix → challenge** |
| 13 | `qa 0 f: r= q qA j q 3@a` | `append-csharp-fields`, `append-xml-attributes` | mix, challenge |
| 13 | `qa I# Esc q j @a j @@` | `comment-python-jobs`, `comment-yaml-flags` | isolate, challenge |
| 7 | `v e d` | `select-character-range`, `delete-selected-token`, `integrated-character-edit` | isolate ×2, mix |
| 7 | `V j d` | `select-line-range`, `change-selected-lines` | mix, mix |
| 7 | `Ctrl-v 2j rx` | `select-block-range`, `integrated-column-marker` | mix, isolate |
| 7 | `V j > gv <` | `reselect-line-correction`, `integrated-reselect-correction` | mix, mix |
| 7 | `Ctrl-v 2j A! Esc` | `append-block-demo`, `append-csv-markers` | isolate, mix |
| 6 | `cit Ready Esc` | `change-inside-tag`, `integration-replace-tag` | **isolate → challenge** |
| 6 | `ya{` | `around-open-brace`, `integration-yank-object-literal` | mix, mix |
| 5 | `f- dt"` | `trim-debug-suffix`, `cut-vine` | mix, isolate |
| 1 | `Esc` | 7 exercises | acceptable — Unit 1 is deliberately about one key |

Unit 1 is fine; the rest are not. The pattern worth fixing is specifically
**isolate → challenge duplicates**, where the coverage contract records
escalation that did not happen. A challenge should differ in at least one of:
buffer size, distractor presence, cursor distance, hint level, or number of
composed commands. A language reskin is none of those.

The `integrated-*` and `integration-*` exercises are the worst offenders — they
are named as integrations but several are keystroke-identical to an earlier
isolate in the same unit.

### 3.3 Canonicals that contradict their own lesson

- **`find-shell-flags`** (Unit 10, `find-change-echo`): canonical is
  `f= l ciwon Esc ; l . ; l .`. The manual `l` nudge after each `;` means the
  change is *not* self-contained — which is exactly what the neighboring lesson
  `repeat-friendly-changes` warns against. The exercise demonstrates a
  repeat-hostile change while teaching repeat-friendliness. `cgn` (Tier 2 #8)
  resolves this cleanly.
- **Unit 13 broadly** (see Part 1): every canonical is a uniform single-line
  edit, i.e. the case where `:normal` beats a macro. At minimum, two or three
  Unit 13 exercises should have *irregular* rows — differing field counts,
  differing delimiters, a line that legitimately has nothing to change — so the
  macro's assumptions and the `failure-as-guard` lesson have something real to
  bite on.

### 3.4 Buffer-content observations

- **Content mix is reasonable**: 23 languages, TypeScript (56), log (49),
  JavaScript (41), Python (40), prose (35) leading. Non-code material
  (prose/log/csv/markdown) is 29% overall, which is defensible — logs and CSV
  are legitimate automation targets.
- **Unit 4 is 68% non-code** (19 of 28), and **Unit 7 is 71%** (20 of 28). For
  operator grammar and visual selection — the two units most about *code*
  structure — that ratio is inverted. Worth rebalancing toward code buffers.
- **Unit 6 paragraph and tag objects run on ≤4-line buffers.** `ap` and `at` are
  the two text objects whose whole point is spanning structure; at this size the
  learner cannot see the object do anything a line operator would not.
- **Max line width is 91 characters.** Against the 360px portrait target and the
  14px code-size floor in `AGENTS.md`, that is worth a visual check — wide lines
  in the automation units are the most likely place for horizontal overflow.

### 3.5 Rendering artifact to verify — resolved, no defect

Several Unit 14 canonicals were read as rendering `: g/^const/s /old/ new/ ↵` —
with spaces after `s` and inside the replacement.

**Confirmed benign.** `commandGroups[].display` is never rendered: `app.js` reads
only `group.explanation` from the active group, and the command history is built
from live engine key events, one `<kbd>` per key. Concatenating every Unit 14
canonical's `display` values reproduces its key stream byte for byte, so no
learner has ever seen the spaced form. The appearance came from this review's own
tooling joining the display strings with a space. No content or code change was
made.

---

## Part 4 — Topics to demote to optional

Rare in **both** target environments. The recommendation is not deletion — the
reference value is real — but to stop spending full five-phase cycles on them.

| Topic | Current cost | Recommendation | Reason |
| --- | --- | --- | --- |
| Section/method motions `[[ ]] [] ][ [m ]m [M ]M` | Unit 9, 1 lesson | Reference; keep `[{`/`]}` as one activity | Syntax-dependent, unreliable in emulators, rarely used even by fluent users. The curriculum doc already calls these advanced — follow through. |
| Scroll chords `Ctrl-f Ctrl-b Ctrl-e Ctrl-y` | Unit 9, ~2 lessons | Compress to 1; keep `Ctrl-d`/`Ctrl-u`, `zz zt zb`, `H M L` | All four are bound away by VS Code defaults. |
| Bracket marks `` '[ '] `[ `] `` | Unit 9, 1 lesson | Fold into `set-and-use-marks` | Useful (`` `[v`] ``) but not a lesson's worth. |
| Sentence motions `( )` and `is`/`as` | Units 5 and 6 | Keep paragraphs core; mark sentences optional | Near-useless in code; matters only in Markdown and commit messages. |
| `gq` / `gw` reflow | Unit 4, 1 lesson | Mark optional + portability note | Requires `textwidth`; inert under VS Code defaults. Poor use of a core-path lesson. |
| Numbered registers `"1`–`"9`, small-delete `"-` | Unit 8, 2 lessons | Merge into 1 "recovery registers" lesson; keep `"_` core | People reach for `u`, not `"2p`. `"_` is the one that changes daily behavior. |
| `gp` / `gP` | Unit 8, part of a lesson | Reduce to one activity | Rare; `p` vs `P` is the part that matters. |
| Replace mode `R` | Unit 3 | One activity, not a co-equal of `s`/`S` | `r` and `c` cover nearly all real cases. |
| Angle-bracket objects `i<` `a<` | Unit 6, 1 lesson | Fold into `bracket-and-brace-objects` | Mechanics identical to other pairs; the separate lesson teaches nothing new. |
| `;` in Ex ranges, address offsets | Unit 11 | Keep lesson, reduce drilling | One clear `,` vs `;` contrast is enough. |

Net: roughly 8–10 lessons reclaimed, approximately funding all of Tier 1. The
recommended path gets **shorter and more automation-dense** without losing
reference coverage.

---

## Part 5 — On "enter and exit the editor"

Your instinct is right, and there is a concrete design reason beyond taste: the
app's format cannot represent these commands honestly. Every activity is defined
by an initial buffer, a target buffer, a cursor, and a mode. `:q` has no target
state — the editor in the exercise is by definition already open and stays open.
Authoring `:wq` as an exercise would teach the keystroke while demonstrating the
opposite of its effect.

The material still matters, though: a learner who never opens standalone Vim
will eventually land in a `git commit` buffer or an SSH session.

**Recommendation:** a **reference card deck** under Reference — no progression,
no unlocking, no exercises. About six cards:

1. Leaving safely — `:w`, `:q`, `:x`, `ZZ`, `ZQ`, `:q!`, and what "modified
   buffer" means.
2. Files and buffers — `:e`, `:ls`, `:b`, `:bd`; buffer vs window vs tab.
3. Windows — `:sp`, `:vs`, `Ctrl-w hjkl`, `Ctrl-w c`, `Ctrl-w o`.
4. Help — `:help {topic}`, `Ctrl-]`, `Ctrl-t`.
5. Starting Vim with work queued — `vim -c`, `vim -es`, `ex -sc`.
6. Filters and shell — `:%!sort`, `:r !cmd`, `!{motion}cmd`.

Each card should carry a **host column**: what it does in terminal Vim, and what
happens in VS Code (`:w` works; `:q` closes the tab; `:sp` splits the editor
group). That column is what turns these from trivia into usable knowledge.

Cards 5 and 6 serve the automation goal directly, and a conventional "how to
quit Vim" lesson would never include them.

---

## Part 6 — The missing command-line automation story

This is the clearest mismatch between the stated goal and the built curriculum.
You described two targets — automation inside VS Code, and automation from the
command line — and only the first is served. Everything in Arc 3 operates on a
single buffer. There is no `:argdo`, `:bufdo`, quickfix, `:cdo`, `vim -c`, or
`ex -sc` anywhere in the content; the curriculum doc relegates them to
"orientation only".

That was defensible for an embedded-editor product. It is not consistent with
the goal you described. The whole reason to reach for Vim at the command line —
rather than staying in VS Code — is to apply one tested transformation to fifty
files.

**Recommendation:** a compact **Unit 15: Batch automation beyond one buffer**,
about 5 lessons, deliberately conceptual:

1. The argument list and `:argdo` — `vim *.js`, then
   `:argdo %s/old/new/ge | update`, and why `e` and `update` are not optional.
2. Buffers and `:bufdo`; how it differs from `:argdo`.
3. Quickfix as a work list — populate from a search, then `:cdo` / `:cfdo`.
4. Non-interactive Vim — `vim -c 'commands' file`, `ex -sc`, `vim -es`; when a
   scripted Vim run beats a shell pipeline.
5. Decision lesson — when to stay in Vim and when `sed`, `awk`, `jq`, or a real
   script is the right answer. The honest counterpart to Unit 14's
   `choose-automation`.

**Feasibility, stated plainly:** the app's editor is one CodeMirror buffer, so
this unit cannot use the normal exercise type. It would be built from `theory`,
`demo`, and `choice` activities — predict the outcome, choose the mechanism,
spot the missing `| update`. That is a weaker learning mode than the guided
exercises elsewhere, and the unit should be honest about being a *briefing*
rather than a drill. Still worth building: the failure mode here is not fumbling
keystrokes, it is not knowing the mechanism exists.

Alternative worth considering: fold this into the Unit 16 mastery layer as
"field notes" rather than a numbered unit, so the recommended path does not end
on a unit without real practice.

---

## Part 7 — The host-reality layer

The curriculum doc excludes "particular IDE shortcuts, extension configuration,
or host-specific emulation bugs". Keeping configuration and bug-chasing out is
right. But every unit already carries a `priorityAndPortability` field doing
genuinely useful work that the learner never sees.

The highest-value facts are small and stable:

- `Ctrl-f`, `Ctrl-b`, `Ctrl-e`, `Ctrl-y`, `Ctrl-w`, `Ctrl-r`, `Ctrl-d` are
  claimed by VS Code by default — this hits Units 3, 7, 8, and 9 directly.
- `Ctrl-v` conflicts with paste on Windows and Linux.
- `Ctrl-a` / `Ctrl-x` collide with select-all and cut.
- `gq` and `=` behave differently or not at all without configuration.
- `:normal` and `:g` support in the VS Code extension is narrower than real Vim.

**Recommendation:** surface `priorityAndPortability` as a short "in your editor"
note at each unit summary, and add one reference card listing reserved chords.
Do not teach configuration; just tell the learner which keys need a decision.

---

## Part 8 — Structural observations

**Choice activities are under-used and unevenly distributed.** Every unit uses
exactly one `choice` activity except Unit 1 (10) and Unit 7 (9). Across 744
activities there are 30 choices — 4%. The curriculum doc's automation decision
framework is one of its strongest sections and explicitly calls for "select the
mechanism before entering keys", but the content does not reflect that
weighting. Tool-choice discrimination is the skill separating someone who knows
commands from someone who automates well, and it is the cheapest activity type
to author: no engine work, no conformance fixtures. **This is the highest
return-on-effort change in the whole review.**

**Concept coverage is tracked; retention is not.** The per-unit `coverage`
arrays map every concept to its five phases — genuinely rigorous. But the sixth
step of the lesson loop, *revisit*, has no home in the data model. Every concept
is introduced and never scheduled to return. That is Units 15–16 again.

**Prerequisites are declared but flat.** Units 5–11 all declare essentially the
same six-unit prerequisite list. Accurate, but it does not discriminate — the
graph cannot recommend an order within Arc 2, and a learner skipping toward
automation gets no useful guidance about what they truly need. Units 12 and 13
do this better, naming specific upstream units. Narrowing Arc 2's prerequisites
would make the test-out path meaningfully better.

**Unit sizing is uneven.** Unit 1 has 5 lessons, Unit 9 has 11. The Part 4
demotions bring Unit 9 to about 7, matching the rest.

---

## Part 9 — Suggested order of work

Ordered by return on effort, cheapest and highest-value first.

1. **Enlarge automation-unit buffers** (Units 12–14) to 16–24 lines with
   scattered, non-adjacent matches, using the existing `viewport` mechanism so
   visible rows are unchanged. Almost entirely a content change, plus a small
   impact readout and match map. Repairs the central credibility problem of the
   automation arc.
2. **Add tool-choice `choice` activities across Arc 3.** No engine work, no
   fixtures, directly targets the judgment the product exists to build.
3. **De-duplicate the challenge phase** — Units 6, 7, 13 first. Give each
   challenge at least one real escalation dimension.
4. **Rework Unit 13 around irregular structure** so macros are taught on the
   case where macros actually win, and so `failure-as-guard` has something to
   guard against.
5. **Add the Tier 1 items needing no patch**: `:g/pat/t$` and `:g/pat/m0` (#4),
   read-only registers (#3), `:sort n`/`u` (#7); plus Tier 2 `cgn` + `.` (#8),
   `:g` dry-runs (#10), undo grouping (#9).
6. **Build the reference decks** — survival, host reality, CLI invocation.
   Cheap, and closes the "how do I quit" question without distorting the format.
7. **Verify then author the patch-dependent Tier 1 items**: Insert-mode
   `Ctrl-r`/`Ctrl-o`/`Ctrl-w` (#1), search as an operator range (#2), Visual
   Block `$` (#6), `g Ctrl-a` (#5).
8. **Apply the Part 4 demotions**, reclaiming ~8–10 lessons.
9. **Author Unit 15 capstones.** Largest win for automation judgment, largest
   authoring cost.
10. **Decide on the batch/CLI unit** — separate unit, or field notes in the
    mastery layer.
