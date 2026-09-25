# Market research

Why this product exists and where it sits in the market. Condensed from two
independent research passes (one by Claude, one by ChatGPT deep research) run
before the first prototype. **All figures are as of July 2026 and have not
been re-verified**; third-party traffic and download numbers are directional
estimates, not first-party analytics.

## Is Vim still worth learning?

Yes — as a portable editing language more than as a standalone editor.

- **Usage is steady, not collapsing.** Stack Overflow's 2025 survey: Vim at
  ~24% and Neovim at ~14–15% of respondents, against VS Code at ~76–84%. The
  survey is multi-select, so most "Vim users" also use VS Code. Among
  professionals who use AI tools, Vim still registered 23.3% and Neovim 13.5%.
  Neovim had the highest admiration rating of any environment in 2024 (83%).
- **Vim motions live inside other tools.** VSCodeVim has ~8–9M installs and
  VSCode Neovim ~650K. Vim modes exist in JetBrains, Zed, Cursor, terminal
  agents such as Claude Code, and Bash's Readline vi mode.
- **AI shifts the value rather than removing it.** One camp argues agents make
  manual editing speed matter less. The stronger argument: AI moves time from
  writing to reviewing, navigating, and surgically correcting generated code,
  which is where motions shine. Terminal-centric agent tools also pull
  developers back into terminals where modal editing is native.
- **Prognosis.** The standalone editor is a stable niche; the motion/operator
  grammar has a long shelf life and a growing number of hosts. Vimscript,
  configuration, and plugin ecosystems do not transfer and are not worth
  teaching.

## When Vim beats the alternatives

The subset of Vim that automates predictable edits — dot-repeat, counts,
macros, `:s` with regex, `:g`/`:v`, `:normal`, Visual Block — is exactly what
most trainers teach worst.

| Tool | Wins when |
| --- | --- |
| Manual Vim (dot-repeat, macro) | The edit is regular in structure, roughly 3–200 instances, in one or a few open files. No setup latency and no verification burden. |
| Multi-cursor / regex replace | Instances are uniform enough to select at once. Eats much of the middle ground in VS Code. |
| LLM edit | The change needs judgment, or spans many files, and a 30–120 s round-trip plus review is acceptable. |
| Generated script (sed, Python) | The edit is mechanically specifiable, repository-wide, and worth keeping as a re-runnable artifact. |

Vim's differentiated value is therefore dot-repeat, macros over *irregular*
structure where multi-cursor fails, and `:g`/`:normal` for line-predicated
batch edits.

Host caveat: VSCodeVim is a reimplementation whose macros are slow and can
corrupt the undo stack; vscode-neovim embeds a real Neovim and gives real
macros, `:g`, and regex inside VS Code. Its `.vimrc` support is remaps only.

## The incumbent: Vim Adventures

A puzzle game (2012, still maintained) where you play a cursor collecting keys
in a Zelda-like world; you cannot advance until you use a skill.

- **Price:** $35 Game-Only or $40 Game & Challenges, both for **six months** of
  access. 60+ commands across 13 levels; the first three levels are free. The
  price has crept up from $25.
- **Strong on:** hjkl, word motions, `f`/`t`, line and screen motions, counts,
  search, `d`/`c`/`y` and friends, dot-repeat, marks, undo — and unusually deep
  **registers and text objects**.
- **Missing:** Visual mode entirely (including Visual Block), `:s`, regex,
  `:g`/`:v`, `J`, the jumplist. Macros only in the paid challenges tier.
  Exercises use prose, not source code.
- **Architecture:** server-side game logic, so online-only with visible input
  latency; sessions expire; 2012-era art; **refuses mobile devices** outright.
- **Sentiment, stable for a decade and bimodal.** Praised as the thing that
  made Vim stick; resented for the six-month license ("I'd pay once") and for
  late levels that become puzzles instead of muscle memory. The pricing
  complaint has spawned free alternatives.
- **Traffic:** ~63K monthly visits in late 2024, ~50% bounce, very short
  average visits. Global rank slid from roughly #650K (Nov 2024) to #809K
  (June 2026). A mature product coasting on search and word of mouth.

## Competitors

| Product | Shape | Note |
| --- | --- | --- |
| Vim Adventures | Web game, 6-month license | Incumbent; see above |
| VimKata | Android + iOS, one-time unlock | 135 exercises in 7 levels, per-keystroke S–D grading, optimal solution shown. Positions itself as a *companion*: "your physical keyboard builds the muscle memory." Closest competitor and proof of mobile demand. |
| VimHero | Web course | 50+ interactive lessons on real code, generated challenges, per-skill tracking, includes Visual mode |
| Vim Master | Android quiz app | 100K+ downloads. Four-choice questions; criticized for teaching bad habits. Multiple choice is the wrong interaction model. |
| VimVenture, VimGym, VimSanity | Free web trainers | Keystroke-golf puzzles, daily challenges, leaderboards |
| OpenVim, VimGenius, vimtutor, VimGolf | Free, older | Tutorials and golf; ~20–40K monthly visits for the web ones |
| VSCODE VIM ACADEMY | VS Code extension | ~13.6K installs |

The market is moving from "cute fantasy wrapper" to practical, measurable
skill-building on real code. Nothing on mobile combines a narrative world,
scheduled review, and the automation subset.

## Gaps an alternative can own

Derived before, and independently of, the mobile idea:

1. **Retention as a system.** Every trainer is a linear course or golf
   challenge; none schedules review, yet forgetting rarely used commands is the
   core failure.
2. **The automation curriculum.** Macros, `:s`, regex, `:g`, `:normal`, Visual
   Block — taught by nobody in gamified form.
3. **Real code as terrain.** Brackets, signatures, indentation, per-language
   idioms instead of prose.
4. **Telemetry-driven practice.** Personalized drills from real editing
   inefficiencies — no competitor connects training to actual editor behavior.
5. **Business model.** One-time or free-plus-pro pricing, and a fully
   client-side, offline engine — the incumbent's two most-criticized traits.

## Mobile: what a phone can and cannot teach

- **Layout knowledge transfers partly.** Physical touch-typing speed correlates
  with soft-QWERTY speed at r ≈ 0.5, and not at all for an unfamiliar layout.
- **The finger-level motor program does not.** Tactile, eyes-free execution
  does not transfer to glass. The largest mobile-typing study (~37,000 users)
  found touchscreen typing is learned on its own; two-thumb typists reach ~38
  WPM, about 25% slower than physical keyboards.
- **Positioning that follows.** A phone builds the cognitive layer — command
  vocabulary, operator + motion grammar, tool choice, chunked sequences like
  `ci(` — which is the larger part of Vim competence and the part people
  forget. Home-row mechanics still need desktop repetitions. Claim "grammar and
  recall trainer", never "muscle memory on the train"; a false promise earns
  exactly the reviews the quiz apps get.
- **Input.** Not a miniature system keyboard: a purpose-built command keyboard
  in true QWERTY positions (so spatial transfer works), a shift layer for
  symbols, and generous targets. Two thumbs suit short command bursts.
- **Loop.** On a commute nobody wants to walk a map before a drill. The world
  is flavor, progression, and retention scaffolding; the core loop is one
  exercise, one insight, one retry.

## Content generation and correctness

A level is text: initial buffer, target buffer, allowed keys, par. LLMs can
generate themes, narrative, and scenario variety cheaply, but must never be the
authority on solutions. Validate every task against a real editor backend and
compute par by search over editor states. Emulator correctness is the one
component not to vibe-code: subtle emulation bugs are what earned the quiz apps
their "teaches bad habits" reviews.

## Revenue expectations

A niche of niches: the category leader gets ~60K visits a month.

- **Vim Adventures, back of envelope:** 1–3K engaged players a month, 3–10%
  converting at $35 → roughly $1–10K a month. A lifestyle side business.
- **A newcomer on the web:** $0–300 a month in year one is the modal outcome;
  $1–2K a month with a strong Show HN / Reddit / Product Hunt launch and
  continued content.
- **Payer-count view:** hundreds to low thousands of annual payers at $19–39
  net → low tens of thousands a year, low six figures with strong execution.
- **Mobile with a one-time $6–10 unlock:** 10K–100K lifetime installs if launch
  goes well, 2–5% conversion → roughly $1K–50K lifetime, mode in the low
  thousands.

Treat revenue as upside. The durable value is a good product in a persistent
niche — and, for this project, the learning-science and measurement work it
enables (see [ideas/ml-strategy.md](ideas/ml-strategy.md)).
