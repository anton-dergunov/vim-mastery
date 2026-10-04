import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { assertCoreMediaBudget, assertMediaAssets, collectMediaPolicy, contentRevision } from "./src/world/media-policy.js";
import { unitDigest } from "./src/progress/mastery.js";

const rootDirectory = dirname(fileURLToPath(import.meta.url));
// Vite serves and builds the pages in src/. Content and art stay at the
// repository root: the build copies what ships, and in development
// repoStaticFiles serves them at the same URLs.
const sourceDirectory = join(rootDirectory, "src");
const repoStaticPrefixes = ["/content/", "/assets/"];
const staticContentTypes = {
  ".json": "application/json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};
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
  // The mastery digests are built from the same parse as the catalog. They hold
  // the coverage arrays and the type of every activity those arrays cite, which
  // is all the mastery map needs to render a concept's state without loading
  // the unit file that concept lives in.
  const masteryDigests = [];
  const catalog = units.map(path => {
    const unit = JSON.parse(readFileSync(path, "utf8"));
    masteryDigests.push(unitDigest(unit));
    return {
      id: unit.id,
      unitNumber: unit.unitNumber,
      title: unit.title,
      ...(unit.surface ? { surface: unit.surface } : {}),
      lessonCount: unit.lessons.length,
      conceptCount: unit.coverage.length,
      path: `content/units/${relative(join(contentDirectory, "units"), path).replaceAll("\\", "/")}`,
    };
  }).sort((left, right) => left.unitNumber - right.unitNumber);
  const worldMediaBytes = assertCoreMediaBudget(rootDirectory, media);
  console.info(`Core media: ${media.core.length} files, ${(worldMediaBytes / 1024 / 1024).toFixed(2)} MiB`);
  return {
    units, media, catalog, arcs: catalogMetadata.arcs || [],
    masteryIndex: { schemaVersion: 1, units: masteryDigests.sort((left, right) => left.unitNumber - right.unitNumber) },
  };
}

function repoStaticFiles(request, response, next) {
  const pathname = decodeURIComponent(new URL(request.url || "/", "http://vite.local").pathname);
  if (!repoStaticPrefixes.some(prefix => pathname.startsWith(prefix))) return next();
  const file = normalize(join(rootDirectory, pathname));
  if (!file.startsWith(rootDirectory + sep) || !existsSync(file) || !statSync(file).isFile()) return next();
  response.setHeader("Content-Type", staticContentTypes[extname(file).toLowerCase()] || "application/octet-stream");
  createReadStream(file).pipe(response);
}

function notFoundPage(base) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not found · Vim Wilds</title>
<style>
body { margin: 0; min-height: 100vh; display: grid; place-content: center; gap: 12px; padding: 24px; text-align: center; background: #06110f; color: #f7efdc; font: 16px/1.5 system-ui, sans-serif; }
h1 { margin: 0; font-size: 22px; }
p { margin: 0; }
a { color: #7ed69e; }
</style>
</head>
<body>
<h1>This trail leads nowhere</h1>
<p>That page is not part of The Vim Wilds.</p>
<p><a href="${base}">Back to the start</a></p>
</body>
</html>
`;
}

function pwaBuildPlugin(base, version) {
  return {
    name: "vim-wilds-pwa-build",
    configureServer(server) {
      server.middlewares.use(repoStaticFiles);
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
      const { units, media, catalog, arcs, masteryIndex } = offlineAssets();
      const emit = (fileName, source) => this.emitFile({ type: "asset", fileName, source });
      units.forEach(path => emit(`content/units/${relative(join(contentDirectory, "units"), path)}`, readFileSync(path)));
      emit("content/unit-index.json", JSON.stringify({ schemaVersion: 2, arcs, units: catalog }, null, 2));
      emit("content/language-profiles.json", readFileSync(join(contentDirectory, "language-profiles.json")));
      emit("content/presentation.json", readFileSync(join(contentDirectory, "presentation.json")));
      emit("content/reference.json", readFileSync(join(contentDirectory, "reference.json")));
      emit("content/practice-samples.json", readFileSync(join(contentDirectory, "practice-samples.json")));
      emit("content/field-notes.json", readFileSync(join(contentDirectory, "field-notes.json")));
      emit("content/mastery-index.json", JSON.stringify(masteryIndex, null, 2));
      emit("manifest.webmanifest", readFileSync(join(sourceDirectory, "manifest.webmanifest")));
      emit("assets/characters/manifest.json", readFileSync(join(characterDirectory, "manifest.json")));
      [...media.core, ...media.optional].forEach(asset => emit(asset.path, readFileSync(join(rootDirectory, asset.path))));
      emit("icons/icon-192.png", readFileSync(join(iconDirectory, "icon-192.png")));
      emit("icons/icon-512.png", readFileSync(join(iconDirectory, "icon-512.png")));
      // Without this page some hosts answer every unknown path with the landing
      // page and status 200, so a missing media file would look like a found one.
      emit("404.html", notFoundPage(base));
    },
    writeBundle(outputOptions) {
      const output = outputOptions.dir
        ? resolve(rootDirectory, outputOptions.dir)
        : dirname(resolve(rootDirectory, outputOptions.file || "dist"));
      const serviceWorker = join(output, "service-worker.js");
      rmSync(serviceWorker, { force: true });
      const precacheFiles = walk(output)
        .map(path => relative(output, path).replaceAll("\\", "/"))
        .filter(file => file !== "service-worker.js" && file !== "404.html")
        .filter(file => !file.includes("/animations/") && !file.includes("/variants/"))
        .sort();
      // A page is precached under its directory URL. Some hosts redirect
      // index.html there, and a browser refuses a redirected response as the
      // answer to a navigation.
      const entries = precacheFiles.map(file => `${base}${file.replace(/(^|\/)index\.html$/, "$1")}`);
      const cacheRevision = contentRevision(output, precacheFiles);
      const worker = `const CACHE_NAME = ${JSON.stringify(`vim-wilds-${version}-${cacheRevision}`)};\nconst PRECACHE_URLS = ${JSON.stringify(entries)};\n\nself.addEventListener("install", event => {\n  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)));\n});\n\nself.addEventListener("activate", event => {\n  event.waitUntil(caches.keys().then(names => Promise.all(names\n    .filter(name => name.startsWith("vim-wilds-") && name !== CACHE_NAME)\n    .map(name => caches.delete(name))\n  )).then(() => self.clients.claim()));\n});\n\nself.addEventListener("message", event => {\n  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();\n});\n\nself.addEventListener("fetch", event => {\n  if (event.request.method !== "GET") return;\n  const requestUrl = new URL(event.request.url);\n  if (requestUrl.origin !== self.location.origin) return;\n  event.respondWith((async () => {\n    const cached = await caches.match(event.request);\n    if (cached) return cached;\n    if (event.request.mode === "navigate") {\n      return caches.match(new URL("play/", self.registration.scope));\n    }\n    return fetch(event.request);\n  })());\n});\n`;
      const navigationAwareWorker = worker.replace(
        `const cached = await caches.match(event.request);`,
        // The first screen is where a visitor installs from, so it comes from
        // the network when there is one. Served from the cache it would stay
        // on the old release until an update is applied from inside the app.
        `const landing = new URL("./", self.registration.scope);
    if (event.request.mode === "navigate" && requestUrl.pathname.replace(/\\/?$/, "/") === landing.pathname) {
      try {
        return await fetch(event.request);
      } catch {
        return caches.match(landing);
      }
    }
    const cached = await caches.match(event.request);`,
      );
      writeFileSync(serviceWorker, navigationAwareWorker);
    },
  };
}

export default defineConfig(({ command }) => {
  // The site works under any path. Root is the default; a host that serves it
  // from a subdirectory, as GitHub Pages does, sets VITE_BASE for the build.
  const base = command === "serve" ? "/" : (process.env.VITE_BASE || "/").replace(/\/*$/, "/");
  const revision = (process.env.GITHUB_SHA || shortGitHash()).slice(0, 8);
  const version = process.env.VITE_APP_VERSION || `${packageVersion}-dev.${revision}`;
  return {
    root: sourceDirectory,
    publicDir: false,
    envDir: rootDirectory,
    cacheDir: join(rootDirectory, "node_modules", ".vite"),
    base,
    define: {
      __VIM_WILDS_VERSION__: JSON.stringify(version),
    },
    build: {
      outDir: join(rootDirectory, "dist"),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          landing: join(sourceDirectory, "index.html"),
          play: join(sourceDirectory, "play", "index.html"),
        },
      },
    },
    plugins: [pwaBuildPlugin(base, version)],
  };
});
