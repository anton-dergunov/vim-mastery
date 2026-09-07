/* Vim Wilds feedback receiver.
 *
 * Deployed separately from the app: GitHub Pages is static, so this is the only
 * place a report can land. It is deliberately small and write-only from the
 * public side. Reads require the admin token, which is what keeps the review
 * backlog private while the repository itself is public.
 */

const MAX_BYTES = 2 * 1024 * 1024;

/* The Origin header is set by the browser and page scripts cannot forge it, so
 * this stops another site from posting into the database. It is a filter, not a
 * security boundary: curl can claim any origin it likes. The rate limit, the
 * size cap and the admin token are what actually bound the damage. */
function allowedOrigins(env) {
  return new Set((env.ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean));
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

function authorized(request, env) {
  const header = request.headers.get("Authorization") || "";
  return Boolean(env.ADMIN_TOKEN) && header === `Bearer ${env.ADMIN_TOKEN}`;
}

async function handleReport(request, env, origin) {
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > MAX_BYTES) {
    return json({ error: "payload too large" }, { status: 413, headers: corsHeaders(origin) });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "expected multipart form data" }, { status: 400, headers: corsHeaders(origin) });
  }

  // A multipart field arrives as a string from the app's FormData and as a File
  // from anything that uploads it as a part, curl included. Reading either keeps
  // the live endpoint debuggable from a shell.
  const fieldText = async field => (
    typeof field?.text === "function" ? field.text() : (field == null ? "" : String(field))
  );

  let report;
  try {
    report = JSON.parse(await fieldText(form.get("report")));
  } catch {
    return json({ error: "report must be JSON" }, { status: 400, headers: corsHeaders(origin) });
  }
  if (!report || typeof report !== "object") {
    return json({ error: "report must be an object" }, { status: 400, headers: corsHeaders(origin) });
  }

  const id = crypto.randomUUID();
  const screenshot = form.get("screenshot");
  let screenshotKey = null;

  // A report with no image is ordinary. Only store an object when one arrived.
  if (screenshot && typeof screenshot.arrayBuffer === "function" && screenshot.size > 0) {
    if (screenshot.size > MAX_BYTES) {
      return json({ error: "screenshot too large" }, { status: 413, headers: corsHeaders(origin) });
    }
    screenshotKey = `screenshots/${id}.webp`;
    await env.SCREENSHOTS.put(screenshotKey, await screenshot.arrayBuffer(), {
      httpMetadata: { contentType: screenshot.type || "image/webp" },
    });
  }

  const place = report.location || {};
  await env.DB.prepare(`
    INSERT INTO reports (id, created_at, app_version, surface, unit_id, lesson_id,
                         activity_id, category, note, markdown, payload_json, screenshot_key)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
  `).bind(
    id,
    report.createdAt || new Date().toISOString(),
    report.app?.version || null,
    place.surface || null,
    place.unitId || null,
    place.lessonId || null,
    place.activityId || null,
    report.category || null,
    report.note || "",
    await fieldText(form.get("markdown")),
    JSON.stringify(report),
    screenshotKey,
  ).run();

  // The client IP is deliberately not recorded. Cloudflare needs it to route
  // and rate-limit the request; this database has no use for it.
  return json({ id }, { status: 201, headers: corsHeaders(origin) });
}

async function handleList(request, env) {
  const url = new URL(request.url);
  const since = url.searchParams.get("since") || "";
  const limit = Math.min(Number(url.searchParams.get("limit") || 100), 500);
  const { results } = await env.DB.prepare(`
    SELECT id, created_at, app_version, surface, unit_id, lesson_id, activity_id,
           category, note, markdown, payload_json, screenshot_key
    FROM reports
    WHERE created_at > ?1
    ORDER BY created_at ASC
    LIMIT ?2
  `).bind(since, limit).all();
  return json({ reports: results });
}

async function handleScreenshot(env, id) {
  const object = await env.SCREENSHOTS.get(`screenshots/${id}.webp`);
  if (!object) return new Response("not found", { status: 404 });
  return new Response(object.body, {
    headers: { "Content-Type": object.httpMetadata?.contentType || "image/webp" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowed = allowedOrigins(env);

    if (request.method === "OPTIONS") {
      return allowed.has(origin)
        ? new Response(null, { status: 204, headers: corsHeaders(origin) })
        : new Response("forbidden", { status: 403 });
    }

    if (url.pathname === "/report" && request.method === "POST") {
      if (!allowed.has(origin)) return new Response("forbidden", { status: 403 });
      return handleReport(request, env, origin);
    }

    // Reading is what keeps the backlog private, so it is token-gated and has
    // no CORS headers: it is for the sync script, not for a browser.
    if (url.pathname === "/reports" && request.method === "GET") {
      if (!authorized(request, env)) return new Response("unauthorized", { status: 401 });
      return handleList(request, env);
    }

    const screenshotMatch = url.pathname.match(/^\/screenshot\/([0-9a-f-]{36})$/);
    if (screenshotMatch && request.method === "GET") {
      if (!authorized(request, env)) return new Response("unauthorized", { status: 401 });
      return handleScreenshot(env, screenshotMatch[1]);
    }

    return new Response("not found", { status: 404 });
  },
};
