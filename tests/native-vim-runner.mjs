import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const specialKeys = {
  "Ctrl-v": "\\<C-v>",
  "Ctrl-[": "\\<C-[>",
  Escape: "\\<Esc>",
  Enter: "\\<CR>",
  Tab: "\\<Tab>",
  Backspace: "\\<BS>",
  " ": " ",
};

function normalizeMode(mode) {
  if (mode === "ce" || mode === "cv") return "normal";
  if (mode === "v") return "visual";
  if (mode === "V") return "visual-line";
  if (mode === "\u0016") return "visual-block";
  if (mode.startsWith("i")) return "insert";
  if (mode.startsWith("R")) return "replace";
  if (mode.startsWith("no")) return "operator-pending";
  if (mode.startsWith("c")) return "command-line";
  return "normal";
}

function toVimInput(keys) {
  return keys.map(key => specialKeys[key] || key.replaceAll("\\", "\\\\").replaceAll('"', '\\"')).join("");
}

export function runNativeVim({ initialCode, cursor, setupKeys = [], keys }) {
  const directory = mkdtempSync(join(tmpdir(), "vim-wilds-native-"));
  const output = join(directory, "result.json");
  const script = join(directory, "fixture.vim");
  const vimScript = [
    "set nomore",
    "set expandtab shiftwidth=2 tabstop=2",
    `call setline(1, ${JSON.stringify(initialCode)})`,
    `call cursor(${cursor[0] + 1}, ${cursor[1] + 1})`,
    `call feedkeys("${toVimInput([...setupKeys, ...keys])}", "xt")`,
    `call writefile([json_encode({"code": getline(1, '$'), "cursor": [line('.') - 1, col('.') - 1], "mode": mode(1)})], ${JSON.stringify(output)})`,
    "qa!",
  ].join("\n");

  try {
    writeFileSync(script, vimScript);
    execFileSync("vim", ["-Nu", "NONE", "-n", "-es", "-S", script], { stdio: "pipe" });
    const result = JSON.parse(readFileSync(output, "utf8"));
    return { ...result, mode: normalizeMode(result.mode) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
