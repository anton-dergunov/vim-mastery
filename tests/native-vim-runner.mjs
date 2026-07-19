import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const specialKeys = {
  "Ctrl-a": "\\<C-a>",
  "Ctrl-r": "\\<C-r>",
  "Ctrl-v": "\\<C-v>",
  "Ctrl-x": "\\<C-x>",
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

function aliasRegisterKeys(keys, aliases) {
  return keys.map((key, index) => {
    const previous = keys[index - 1];
    return (previous === '"' || previous === "Ctrl-r") && aliases[key] ? aliases[key] : key;
  });
}

export function runNativeVim({ initialCode, cursor, setupKeys = [], keys, textWidth, registerNames = [], registerAliases = {} }) {
  const directory = mkdtempSync(join(tmpdir(), "vim-wilds-native-"));
  const output = join(directory, "result.json");
  const script = join(directory, "fixture.vim");
  const vimScript = [
    "set nomore",
    "set expandtab shiftwidth=2 tabstop=2",
    ...(textWidth === undefined ? [] : [`set textwidth=${textWidth}`]),
    `call setline(1, ${JSON.stringify(initialCode)})`,
    `call cursor(${cursor[0] + 1}, ${cursor[1] + 1})`,
    `call feedkeys("${toVimInput(aliasRegisterKeys([...setupKeys, ...keys], registerAliases))}", "xt")`,
    `let register_state = {}`,
    `for register_pair in ${JSON.stringify(registerNames.map(name => [name, registerAliases[name] || name]))}`,
    `  let register_name = register_pair[0]`,
    `  let native_register_name = register_pair[1]`,
    `  let register_type = getregtype(native_register_name)`,
    `  let register_state[register_name] = {"text": getreg(native_register_name), "type": register_type ==# 'V' ? 'linewise' : register_type[0] ==# "\\<C-v>" ? 'blockwise' : 'characterwise'}`,
    `endfor`,
    `call writefile([json_encode({"code": getline(1, '$'), "cursor": [line('.') - 1, col('.') - 1], "mode": mode(1), "registers": register_state})], ${JSON.stringify(output)})`,
    "qa!",
  ].join("\n");

  try {
    writeFileSync(script, vimScript);
    execFileSync("vim", ["-Nu", "NONE", "-i", "NONE", "-n", "-es", "-S", script], { stdio: "pipe" });
    const result = JSON.parse(readFileSync(output, "utf8"));
    return { ...result, mode: normalizeMode(result.mode) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
