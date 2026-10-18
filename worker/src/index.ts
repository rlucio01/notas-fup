import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  DB: D1Database;
  AUTH_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for all origins (web app, localhost, mobile)
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-FUP-Secret"],
  })
);

// Public healthcheck
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    app: "Notas FUP Cloud",
    time: new Date().toISOString(),
  });
});

// Auth Verification
app.post("/api/auth/verify", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const headerAuth = c.req.header("Authorization")?.replace("Bearer ", "") || c.req.header("X-FUP-Secret");
  const provided = body.secret || headerAuth;

  if (provided && provided === c.env.AUTH_SECRET) {
    return c.json({ ok: true, message: "Autenticado com sucesso" });
  }
  return c.json({ ok: false, error: "Senha inválida" }, 401);
});

// Auth Middleware for all other /api routes
app.use("/api/*", async (c, next) => {
  const secret = c.env.AUTH_SECRET;
  const authHeader = c.req.header("Authorization");
  const customHeader = c.req.header("X-FUP-Secret");

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : customHeader;

  if (!token || token !== secret) {
    return c.json({ error: "Unauthorized: Senha de acesso necessária" }, 401);
  }

  await next();
});

// ── Contexts ─────────────────────────────────────────────────────────────

app.get("/api/contexts", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM contexts WHERE deleted_at IS NULL ORDER BY name ASC"
  ).all();
  return c.json(results);
});

app.post("/api/contexts", async (c) => {
  const body = await c.req.json();
  const id = body.id || crypto.randomUUID();
  const now = new Date().toISOString();
  const name = body.name?.trim();
  const color = body.color || "#6366f1";

  if (!name) return c.json({ error: "Nome do contexto obrigatório" }, 400);

  await c.env.DB.prepare(
    `INSERT INTO contexts (id, name, color, sync_enabled, archived, created_at, updated_at)
     VALUES (?1, ?2, ?3, 1, 0, ?4, ?4)
     ON CONFLICT(id) DO UPDATE SET name = ?2, color = ?3, updated_at = ?4`
  )
    .bind(id, name, color, now)
    .run();

  const ctx = await c.env.DB.prepare("SELECT * FROM contexts WHERE id = ?1").bind(id).first();
  return c.json(ctx, 201);
});

app.patch("/api/contexts/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    "UPDATE contexts SET name = COALESCE(?1, name), color = COALESCE(?2, color), updated_at = ?3 WHERE id = ?4"
  )
    .bind(body.name ?? null, body.color ?? null, now, id)
    .run();

  const ctx = await c.env.DB.prepare("SELECT * FROM contexts WHERE id = ?1").bind(id).first();
  return c.json(ctx);
});

app.delete("/api/contexts/:id", async (c) => {
  const id = c.req.param("id");
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    "UPDATE contexts SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2"
  ).bind(now, id).run();

  await c.env.DB.prepare(
    "UPDATE items SET context_id = NULL, updated_at = ?1 WHERE context_id = ?2"
  ).bind(now, id).run();

  return c.json({ ok: true });
});

// ── Items ────────────────────────────────────────────────────────────────

app.get("/api/items", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT i.*, c.name as context_name, c.color as context_color
     FROM items i
     LEFT JOIN contexts c ON i.context_id = c.id
     WHERE i.deleted_at IS NULL
     ORDER BY
       CASE
         WHEN i.status = 'open' THEN 0
         WHEN i.status = 'waiting' THEN 1
         WHEN i.status = 'inbox' THEN 2
         ELSE 3
       END,
       i.position ASC,
       i.created_at DESC`
  ).all();

  return c.json(results);
});

app.post("/api/items", async (c) => {
  const body = await c.req.json();
  const id = body.id || crypto.randomUUID();
  const now = new Date().toISOString();

  const status = body.status === "inbox" && body.context_id ? "open" : (body.status || "inbox");
  const doneAt = status === "done" ? now : null;

  await c.env.DB.prepare(
    `INSERT INTO items (
       id, context_id, kind, title, body, status, waiting_on, followup_at,
       due_at, ticket_ref, url, done_at, source, origin_app, position, created_at, updated_at
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?16)`
  )
    .bind(
      id,
      body.context_id || null,
      body.kind || "task",
      body.title,
      body.body || null,
      status,
      body.waiting_on || null,
      body.followup_at || null,
      body.due_at || null,
      body.ticket_ref || null,
      body.url || null,
      doneAt,
      body.source || "mobile",
      body.origin_app || null,
      body.position ?? 0.0,
      body.created_at || now
    )
    .run();

  const item = await c.env.DB.prepare(
    `SELECT i.*, c.name as context_name, c.color as context_color
     FROM items i
     LEFT JOIN contexts c ON i.context_id = c.id
     WHERE i.id = ?1`
  )
    .bind(id)
    .first();

  return c.json(item, 201);
});

app.patch("/api/items/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const now = new Date().toISOString();

  const existing = await c.env.DB.prepare("SELECT * FROM items WHERE id = ?1").bind(id).first<any>();
  if (!existing) return c.json({ error: "Item not found" }, 404);

  const newStatus = body.status ?? existing.status;
  let doneAt = existing.done_at;
  if (newStatus === "done" && !doneAt) {
    doneAt = now;
  } else if (newStatus !== "done") {
    doneAt = null;
  }

  await c.env.DB.prepare(
    `UPDATE items SET
       context_id = CASE WHEN ?1 THEN ?2 ELSE context_id END,
       title = COALESCE(?3, title),
       body = CASE WHEN ?4 THEN ?5 ELSE body END,
       status = COALESCE(?6, status),
       waiting_on = CASE WHEN ?7 THEN ?8 ELSE waiting_on END,
       followup_at = CASE WHEN ?9 THEN ?10 ELSE followup_at END,
       due_at = CASE WHEN ?11 THEN ?12 ELSE due_at END,
       ticket_ref = CASE WHEN ?13 THEN ?14 ELSE ticket_ref END,
       url = CASE WHEN ?15 THEN ?16 ELSE url END,
       done_at = ?17,
       position = COALESCE(?18, position),
       updated_at = ?19
     WHERE id = ?20`
  )
    .bind(
      "context_id" in body,
      body.context_id ?? null,
      body.title ?? null,
      "body" in body,
      body.body ?? null,
      body.status ?? null,
      "waiting_on" in body,
      body.waiting_on ?? null,
      "followup_at" in body,
      body.followup_at ?? null,
      "due_at" in body,
      body.due_at ?? null,
      "ticket_ref" in body,
      body.ticket_ref ?? null,
      "url" in body,
      body.url ?? null,
      doneAt,
      body.position ?? null,
      now,
      id
    )
    .run();

  const item = await c.env.DB.prepare(
    `SELECT i.*, c.name as context_name, c.color as context_color
     FROM items i
     LEFT JOIN contexts c ON i.context_id = c.id
     WHERE i.id = ?1`
  )
    .bind(id)
    .first();

  return c.json(item);
});

app.delete("/api/items/:id", async (c) => {
  const id = c.req.param("id");
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    "UPDATE items SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2"
  )
    .bind(now, id)
    .run();

  return c.json({ ok: true });
});

app.post("/api/items/reorder", async (c) => {
  const { itemIds } = await c.req.json<{ itemIds: string[] }>();
  if (!Array.isArray(itemIds)) return c.json({ error: "itemIds must be array" }, 400);

  const now = new Date().toISOString();
  const statements = itemIds.map((id, index) =>
    c.env.DB.prepare("UPDATE items SET position = ?1, updated_at = ?2 WHERE id = ?3").bind(
      index,
      now,
      id
    )
  );

  await c.env.DB.batch(statements);
  return c.json({ ok: true, count: itemIds.length });
});

// ── Sincronização Bidirecional (Delta Sync) ───────────────────────────────

app.get("/api/sync", async (c) => {
  const since = c.req.query("since") || "1970-01-01T00:00:00Z";
  const serverTime = new Date().toISOString();

  const [itemsRes, contextsRes] = await Promise.all([
    c.env.DB.prepare(
      `SELECT i.*, c.name as context_name, c.color as context_color
       FROM items i
       LEFT JOIN contexts c ON i.context_id = c.id
       WHERE i.updated_at > ?1`
    )
      .bind(since)
      .all(),
    c.env.DB.prepare("SELECT * FROM contexts WHERE updated_at > ?1")
      .bind(since)
      .all(),
  ]);

  return c.json({
    server_time: serverTime,
    items: itemsRes.results,
    contexts: contextsRes.results,
  });
});

app.post("/api/sync", async (c) => {
  const { items = [], contexts = [] } = await c.req.json<{ items: any[]; contexts: any[] }>();
  const serverTime = new Date().toISOString();

  // If no changes were provided, short-circuit immediately without executing D1 statements
  if (items.length === 0 && contexts.length === 0) {
    return c.json({
      ok: true,
      server_time: serverTime,
      processed_items: 0,
      processed_contexts: 0,
    });
  }

  const statements: D1PreparedStatement[] = [];

  // 1. Process contexts (Last-Write-Wins based on updated_at)
  for (const ctx of contexts) {
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO contexts (id, name, color, sync_enabled, archived, created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           color = excluded.color,
           sync_enabled = excluded.sync_enabled,
           archived = excluded.archived,
           updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at
         WHERE excluded.updated_at >= contexts.updated_at`
      ).bind(
        ctx.id,
        ctx.name,
        ctx.color || "#6366f1",
        ctx.sync_enabled ?? 1,
        ctx.archived ?? 0,
        ctx.created_at || serverTime,
        ctx.updated_at || serverTime,
        ctx.deleted_at || null
      )
    );
  }

  // 2. Process items (Last-Write-Wins based on updated_at)
  for (const item of items) {
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO items (
           id, context_id, kind, title, body, status, waiting_on, followup_at,
           due_at, ticket_ref, url, done_at, source, origin_app, position,
           created_at, updated_at, deleted_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
         ON CONFLICT(id) DO UPDATE SET
           context_id = excluded.context_id,
           kind = excluded.kind,
           title = excluded.title,
           body = excluded.body,
           status = excluded.status,
           waiting_on = excluded.waiting_on,
           followup_at = excluded.followup_at,
           due_at = excluded.due_at,
           ticket_ref = excluded.ticket_ref,
           url = excluded.url,
           done_at = excluded.done_at,
           source = excluded.source,
           origin_app = excluded.origin_app,
           position = excluded.position,
           updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at
         WHERE excluded.updated_at >= items.updated_at`
      ).bind(
        item.id,
        item.context_id || null,
        item.kind || "task",
        item.title,
        item.body || null,
        item.status || "inbox",
        item.waiting_on || null,
        item.followup_at || null,
        item.due_at || null,
        item.ticket_ref || null,
        item.url || null,
        item.done_at || null,
        item.source || "sync",
        item.origin_app || null,
        item.position ?? 0.0,
        item.created_at || serverTime,
        item.updated_at || serverTime,
        item.deleted_at || null
      )
    );
  }

  // Execute in batches of 50 to adhere to D1 limits
  const chunkSize = 50;
  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize);
    if (chunk.length > 0) {
      await c.env.DB.batch(chunk);
    }
  }

  return c.json({
    ok: true,
    server_time: serverTime,
    processed_items: items.length,
    processed_contexts: contexts.length,
  });
});

export default app;
