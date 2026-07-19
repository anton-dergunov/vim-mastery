import { execFileSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDirectory = dirname(fileURLToPath(import.meta.url));
const contentDirectory = join(rootDirectory, "content");
const characterDirectory = join(rootDirectory, "assets", "characters");
const packageVersion = JSON.parse(readFileSync(join(rootDirectory, "package.json"), "utf8")).version;

function shortGitHash() {
  try {
    return execFileSync("git", ["rev-parse", "--short=8", "HEAD"], { cwd: rootDirectory, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  }
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function pwaIcon(size) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  const scale = size / 64;
  for (let y = 0; y < size; y += 1) {
    pixels[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x += 1) {
      const left = x / scale;
      const top = y / scale;
      const inset = Math.min(left, top, 63 - left, 63 - top);
      const gold = ((left > 15 && left < 27 && top > 14 && top < 46 - (left - 15) * 1.6)
        || (left >= 27 && left <= 48 && top > 14 && top < 46 && top > (left - 27) * 1.2 + 14))
        && inset > 5;
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      pixels[offset] = gold ? 255 : 7;
      pixels[offset + 1] = gold ? 200 : 23;
      pixels[offset + 2] = gold ? 102 : 21;
      pixels[offset + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(pixels)), pngChunk("IEND", Buffer.alloc(0))]);
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function offlineAssets() {
  const units = walk(join(contentDirectory, "units")).filter(path => path.endsWith(".json"));
  const idleImages = walk(characterDirectory).filter(path => path.endsWith("idle.png"));
  const catalog = units.map(path => {
    const unit = JSON.parse(readFileSync(path, "utf8"));
    return {
      id: unit.id,
      unitNumber: unit.unitNumber,
      title: unit.title,
      lessonCount: unit.lessons.length,
      path: `content/units/${relative(join(contentDirectory, "units"), path).replaceAll("\\", "/")}`,
    };
  }).sort((left, right) => left.unitNumber - right.unitNumber);
  return { units, idleImages, catalog };
}

function pwaBuildPlugin(base, version) {
  return {
    name: "vim-wilds-pwa-build",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url || "/", "http://vite.local");
        if (url.pathname === "/" && ["unit", "activity", "preview"].some(key => url.searchParams.has(key))) {
          response.statusCode = 302;
          response.setHeader("Location", `/play/${url.search}`);
          response.end();
          return;
        }
        next();
      });
    },
    generateBundle() {
      const { units, idleImages, catalog } = offlineAssets();
      const emit = (fileName, source) => this.emitFile({ type: "asset", fileName, source });
      units.forEach(path => emit(`content/units/${relative(join(contentDirectory, "units"), path)}`, readFileSync(path)));
      emit("content/unit-index.json", JSON.stringify({ schemaVersion: 1, units: catalog }, null, 2));
      emit("content/language-profiles.json", readFileSync(join(contentDirectory, "language-profiles.json")));
      emit("manifest.webmanifest", readFileSync(join(rootDirectory, "manifest.webmanifest")));
      emit("assets/characters/manifest.json", readFileSync(join(characterDirectory, "manifest.json")));
      idleImages.forEach(path => emit(`assets/characters/${relative(characterDirectory, path)}`, readFileSync(path)));
      emit("icons/icon-192.png", pwaIcon(192));
      emit("icons/icon-512.png", pwaIcon(512));
    },
    closeBundle() {
      const output = join(rootDirectory, "dist");
      const serviceWorker = join(output, "service-worker.js");
      rmSync(serviceWorker, { force: true });
      const entries = walk(output)
        .filter(path => !path.endsWith("service-worker.js"))
        .map(path => `${base}${relative(output, path).replaceAll("\\", "/")}`);
      const worker = `const CACHE_NAME = ${JSON.stringify(`vim-wilds-${version}`)};\nconst BASE_PATH = ${JSON.stringify(base)};\nconst PRECACHE_URLS = ${JSON.stringify(entries)};\n\nself.addEventListener("install", event => {\n  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)));\n});\n\nself.addEventListener("activate", event => {\n  event.waitUntil(caches.keys().then(names => Promise.all(names\n    .filter(name => name.startsWith("vim-wilds-") && name !== CACHE_NAME)\n    .map(name => caches.delete(name))\n  )).then(() => self.clients.claim()));\n});\n\nself.addEventListener("message", event => {\n  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();\n});\n\nself.addEventListener("fetch", event => {\n  if (event.request.method !== "GET") return;\n  const requestUrl = new URL(event.request.url);\n  if (requestUrl.origin !== self.location.origin) return;\n  event.respondWith((async () => {\n    const cached = await caches.match(event.request);\n    if (cached) return cached;\n    if (event.request.mode === "navigate") {\n      return caches.match(new URL("play/index.html", self.registration.scope));\n    }\n    return fetch(event.request);\n  })());\n});\n`;
      const navigationAwareWorker = worker.replace(
        `if (event.request.mode === "navigate") {
      return caches.match(new URL("play/index.html", self.registration.scope));
    }`,
        `if (event.request.mode === "navigate") {
      if (requestUrl.pathname === BASE_PATH || requestUrl.pathname === BASE_PATH.slice(0, -1)) {
        return caches.match(new URL("index.html", self.registration.scope));
      }
      return caches.match(new URL("play/index.html", self.registration.scope));
    }`,
      );
      writeFileSync(serviceWorker, navigationAwareWorker);
    },
  };
}

export default defineConfig(({ command }) => {
  const base = command === "serve" ? "/" : "/vim-mastery/";
  const revision = (process.env.GITHUB_SHA || shortGitHash()).slice(0, 8);
  const version = process.env.VITE_APP_VERSION || `${packageVersion}-dev.${revision}`;
  return {
    base,
    define: {
      __VIM_WILDS_VERSION__: JSON.stringify(version),
      __VIM_WILDS_MEDIA_REVISION__: JSON.stringify(process.env.VITE_MEDIA_REVISION || process.env.GITHUB_SHA || "main"),
    },
    build: {
      rollupOptions: {
        input: {
          landing: join(rootDirectory, "index.html"),
          play: join(rootDirectory, "play", "index.html"),
        },
      },
    },
    plugins: [pwaBuildPlugin(base, version)],
  };
});
