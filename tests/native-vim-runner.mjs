import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const specialKeys = {
  "Ctrl-v": "\\<C-v>",
  Escape: "\\<Esc>",
  Enter: "\\<CR>",
  Tab: "\\<Tab>",
  Backspace: "\\<BS>",
  " ": " ",
};

function toVimInput(keys) {
  return keys.map(key => specialKeys[key] || key.replaceAll("\\", "\\\\").replaceAll('"', '\\"')).join("");
}

export function runNativeVim({ initialCode, cursor, keys }) {
  const directory = mkdtempSync(join(tmpdir(), "vim-wilds-native-"));
  const output = join(directory, "result.json");
  const script = join(directory, "fixture.vim");
  const vimScript = [
    "set nomore",
    "set expandtab shiftwidth=2 tabstop=2",
    `call setline(1, ${JSON.stringify(initialCode)})`,
    `call cursor(${cursor[0] + 1}, ${cursor[1] + 1})`,
    `call feedkeys("${toVimInput(keys)}", "xt")`,
    `call writefile([json_encode({"code": getline(1, '$'), "cursor": [line('.') - 1, col('.') - 1], "mode": mode(1)})], ${JSON.stringify(output)})`,
    "qa!",
  ].join("\n");

  try {
    writeFileSync(script, vimScript);
    execFileSync("vim", ["-Nu", "NONE", "-n", "-es", "-S", script], { stdio: "pipe" });
    return JSON.parse(readFileSync(output, "utf8"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
