import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { assertCoreMediaBudget, assertMediaAssets, collectMediaPolicy, contentRevision } from "./media-policy.js";

const rootDirectory = dirname(fileURLToPath(import.meta.url));
const contentDirectory = join(rootDirectory, "content");
const characterDirectory = join(rootDirectory, "assets", "characters");
const iconDirectory = join(rootDirectory, "assets", "icons");
const packageVersion = JSON.parse(readFileSync(join(rootDirectory, "package.json"), "utf8")).version;

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
  const presentation = JSON.parse(readFileSync(join(contentDirectory, "presentation.json"), "utf8"));
  const characterManifest = JSON.parse(readFileSync(join(characterDirectory, "manifest.json"), "utf8"));
  const media = collectMediaPolicy(presentation, characterManifest);
  assertMediaAssets(rootDirectory, media);
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
  const worldMediaBytes = assertCoreMediaBudget(rootDirectory, media);
  console.info(`Core media: ${media.core.length} files, ${(worldMediaBytes / 1024 / 1024).toFixed(2)} MiB`);
  return {
    units, media, catalog, arcs: catalogMetadata.arcs || [],
  };
}

function pwaBuildPlugin(base, version) {
  return {
    name: "vim-wilds-pwa-build",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url || "/", "http://vite.local");
        if (url.pathname === "/" && ["unit", "activity", "preview", "practice"].some(key => url.searchParams.has(key))) {
          response.statusCode = 302;
          response.setHeader("Location", `/play/${url.search}`);
          response.end();
          return;
        }
        next();
      });
    },
    generateBundle() {
      const { units, media, catalog, arcs } = offlineAssets();
      const emit = (fileName, source) => this.emitFile({ type: "asset", fileName, source });
      units.forEach(path => emit(`content/units/${relative(join(contentDirectory, "units"), path)}`, readFileSync(path)));
      emit("content/unit-index.json", JSON.stringify({ schemaVersion: 2, arcs, units: catalog }, null, 2));
      emit("content/language-profiles.json", readFileSync(join(contentDirectory, "language-profiles.json")));
      emit("content/presentation.json", readFileSync(join(contentDirectory, "presentation.json")));
      emit("content/reference.json", readFileSync(join(contentDirectory, "reference.json")));
      emit("content/practice-samples.json", readFileSync(join(contentDirectory, "practice-samples.json")));
      emit("manifest.webmanifest", readFileSync(join(rootDirectory, "manifest.webmanifest")));
      emit("assets/characters/manifest.json", readFileSync(join(characterDirectory, "manifest.json")));
      [...media.core, ...media.optional].forEach(asset => emit(asset.path, readFileSync(join(rootDirectory, asset.path))));
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
        .filter(path => {
          const relativePath = relative(output, path).replaceAll("\\", "/");
          return !relativePath.includes("/animations/") && !relativePath.includes("/variants/");
        })
        .map(path => `${base}${relative(output, path).replaceAll("\\", "/")}`)
        .sort();
      const precacheFiles = entries.map(entry => entry.slice(base.length));
      const cacheRevision = contentRevision(output, precacheFiles);
      const worker = `const CACHE_NAME = ${JSON.stringify(`vim-wilds-${version}-${cacheRevision}`)};\nconst BASE_PATH = ${JSON.stringify(base)};\nconst PRECACHE_URLS = ${JSON.stringify(entries)};\n\nself.addEventListener("install", event => {\n  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)));\n});\n\nself.addEventListener("activate", event => {\n  event.waitUntil(caches.keys().then(names => Promise.all(names\n    .filter(name => name.startsWith("vim-wilds-") && name !== CACHE_NAME)\n    .map(name => caches.delete(name))\n  )).then(() => self.clients.claim()));\n});\n\nself.addEventListener("message", event => {\n  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();\n});\n\nself.addEventListener("fetch", event => {\n  if (event.request.method !== "GET") return;\n  const requestUrl = new URL(event.request.url);\n  if (requestUrl.origin !== self.location.origin) return;\n  event.respondWith((async () => {\n    const cached = await caches.match(event.request);\n    if (cached) return cached;\n    if (event.request.mode === "navigate") {\n      return caches.match(new URL("play/index.html", self.registration.scope));\n    }\n    return fetch(event.request);\n  })());\n});\n`;
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
