import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDirectory = dirname(fileURLToPath(import.meta.url));
const contentDirectory = join(rootDirectory, "content");
const characterDirectory = join(rootDirectory, "assets", "characters");
const iconDirectory = join(rootDirectory, "assets", "icons");
const worldDirectory = join(rootDirectory, "assets", "worlds");
const packageVersion = JSON.parse(readFileSync(join(rootDirectory, "package.json"), "utf8")).version;
const WORLD_MEDIA_WARNING_BYTES = 30 * 1024 * 1024;
const WORLD_MEDIA_LIMIT_BYTES = 50 * 1024 * 1024;

function shortGitHash() {
  try {
    return execFileSync("git", ["rev-parse", "--short=8", "HEAD"], { cwd: rootDirectory, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
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
  const moonrootMedia = walk(join(worldDirectory, "moonroot-ruins", "scenes")).filter(path => path.endsWith(".webp"));
  const catalogMetadata = JSON.parse(readFileSync(join(contentDirectory, "unit-index.json"), "utf8"));
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
  const worldMediaBytes = moonrootMedia.reduce((total, path) => total + statSync(path).size, 0);
  if (worldMediaBytes > WORLD_MEDIA_LIMIT_BYTES) {
    throw new Error(`World/story media is ${(worldMediaBytes / 1024 / 1024).toFixed(2)}MB; production limit is 50MB`);
  }
  if (worldMediaBytes > WORLD_MEDIA_WARNING_BYTES) {
    console.warn(`World/story media is ${(worldMediaBytes / 1024 / 1024).toFixed(2)}MB; review above the 30MB warning threshold`);
  }
  return { units, idleImages, moonrootMedia, catalog, arcs: catalogMetadata.arcs || [] };
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
      const { units, idleImages, moonrootMedia, catalog, arcs } = offlineAssets();
      const emit = (fileName, source) => this.emitFile({ type: "asset", fileName, source });
      units.forEach(path => emit(`content/units/${relative(join(contentDirectory, "units"), path)}`, readFileSync(path)));
      emit("content/unit-index.json", JSON.stringify({ schemaVersion: 2, arcs, units: catalog }, null, 2));
      emit("content/language-profiles.json", readFileSync(join(contentDirectory, "language-profiles.json")));
      emit("content/presentation.json", readFileSync(join(contentDirectory, "presentation.json")));
      emit("manifest.webmanifest", readFileSync(join(rootDirectory, "manifest.webmanifest")));
      emit("assets/characters/manifest.json", readFileSync(join(characterDirectory, "manifest.json")));
      idleImages.forEach(path => emit(`assets/characters/${relative(characterDirectory, path)}`, readFileSync(path)));
      moonrootMedia.forEach(path => emit(`assets/worlds/${relative(worldDirectory, path)}`, readFileSync(path)));
      emit("icons/icon-192.png", readFileSync(join(iconDirectory, "icon-192.png")));
      emit("icons/icon-512.png", readFileSync(join(iconDirectory, "icon-512.png")));
    },
    writeBundle(outputOptions) {
      const output = outputOptions.dir
        ? resolve(rootDirectory, outputOptions.dir)
        : dirname(resolve(rootDirectory, outputOptions.file || "dist"));
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
