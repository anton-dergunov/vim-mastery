# The Vim Wilds

A mobile-first, offline-capable course for learning Vim through short
exercises, installable as a web app. It runs CodeMirror 6 with the Replit Vim
extension, so the editor executes real Vim commands, and checks every taught
command against native Vim.

Live at <https://anton-dergunov.github.io/vim-mastery/>.

## Run locally

Install dependencies once, then start the development server:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`); the app
itself is at `/play/`.

## Test

```bash
npm test            # content, native Vim, media, script tests, and a browser smoke run
npm run test:full   # everything CI runs, including the PWA build audit and all browser tests
```

The script tests need Python 3 with numpy, Pillow, and scipy
(`pip install -r scripts/requirements-test.txt`).

## Layout

- `src/` — the web app: landing page, app shell, and code grouped by area.
- `content/` — the curriculum, story, and reference data.
- `assets/` — board art, story art, and characters.
- `tests/` — Node and Playwright suites.
- `scripts/` — the art pipelines (`world-art/`, `characters/`) and feedback tools.
- `worker/` — the feedback receiver, deployed separately.
- `docs/` — design decisions, conformance, art direction, plans, and ideas.
