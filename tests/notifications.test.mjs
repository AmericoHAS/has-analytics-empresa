import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { timingSafeEqual } from "node:crypto";
function worker({
  enabled = "false",
  configured = true,
  responseCode = 200,
  rows = [],
} = {}) {
  const calls = [],
    updates = [],
    sent = [];
  let connections = 0;
  const db = {
    rpc: async (name) => {
      calls.push(name);
      return {
        data: name === "claim_notification_emails" ? rows.splice(0, 1) : null,
        error: null,
      };
    },
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { email: "fixture@example.test" } },
          error: null,
        }),
      },
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { role: "client" }, error: null }),
        }),
      }),
      update: (value) => ({
        eq: async () => {
          updates.push({ table, ...value });
          return { error: null };
        },
      }),
    }),
  };
  const env = {
    CRON_SECRET: "local-test-secret",
    NOTIFICATIONS_ENABLED: enabled,
    ...(configured
      ? {
          RESEND_API_KEY: "fake-local-key",
          NOTIFICATION_FROM: "fixture@example.test",
          SITE_URL: "https://example.test",
        }
      : {}),
  };
  const exports = {};
  const source = ts.transpileModule(
    fs.readFileSync("app/api/cron/notifications/route.ts", "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  vm.runInNewContext(source, {
    exports,
    Buffer,
    process: { env },
    Date,
    URL,
    Math,
    AbortSignal,
    setTimeout: (fn) => {
      fn();
      return 0;
    },
    fetch: async (url, options) => {
      sent.push({ url, options });
      return { ok: responseCode === 200, status: responseCode };
    },
    require: (id) =>
      id === "next/server"
        ? {
            NextResponse: {
              json: (body, options) => ({
                body,
                status: options?.status ?? 200,
              }),
            },
          }
        : id === "node:crypto"
          ? { timingSafeEqual }
          : {
              createAdminClient: () => {
                connections++;
                return db;
              },
            },
  });
  return {
    run: (header = "Bearer local-test-secret") =>
      exports.GET({
        headers: new Headers(header ? { authorization: header } : {}),
      }),
    calls,
    updates,
    sent,
    get connections() {
      return connections;
    },
  };
}
test("cron rejects missing and wrong secrets before database access", async () => {
  const w = worker();
  assert.equal((await w.run("")).status, 401);
  assert.equal((await w.run("Bearer wrong")).status, 401);
  assert.equal(w.connections, 0);
});
test("disabled email generates in-app deadlines without dispatch", async () => {
  const w = worker();
  const result = await w.run();
  assert.equal(result.status, 200);
  assert.equal(result.body.email, "disabled");
  assert.equal(w.sent.length, 0);
  assert.deepEqual(w.calls, ["enqueue_deadline_notifications"]);
});
test("missing provider config keeps the queue unclaimed", async () => {
  const w = worker({ enabled: "true", configured: false });
  assert.equal((await w.run()).status, 503);
  assert(!w.calls.includes("claim_notification_emails"));
});
test("successful dispatch uses idempotency and private portal link", async () => {
  const w = worker({
    enabled: "true",
    rows: [
      {
        id: "notice-1",
        recipient_id: "client",
        title: "Novo documento",
        body: "Consulte sua conta.",
        attempts: 1,
      },
    ],
  });
  const result = await w.run();
  assert.equal(result.body.sent, 1);
  assert.equal(
    w.sent[0].options.headers["Idempotency-Key"],
    "has-notice-notice-1",
  );
  const payload = JSON.parse(w.sent[0].options.body);
  assert(payload.text.includes("https://example.test/area-cliente"));
  assert.equal(w.updates[0].email_status, "sent");
});
test("transient provider failure is recorded for retry", async () => {
  const w = worker({
    enabled: "true",
    responseCode: 429,
    rows: [
      {
        id: "notice-2",
        recipient_id: "client",
        title: "Prazo",
        body: "Confira sua conta.",
        attempts: 1,
      },
    ],
  });
  const result = await w.run();
  assert.equal(result.body.failed, 1);
  assert.equal(w.updates[0].email_status, "pending");
  assert.equal(w.updates[0].last_error, "Provedor retornou HTTP 429.");
});
test("fifth failed attempt is terminal", async () => {
  const w = worker({
    enabled: "true",
    responseCode: 503,
    rows: [
      {
        id: "notice-3",
        recipient_id: "client",
        title: "Prazo",
        body: "Confira sua conta.",
        attempts: 5,
      },
    ],
  });
  await w.run();
  assert.equal(w.updates[0].email_status, "failed");
});
