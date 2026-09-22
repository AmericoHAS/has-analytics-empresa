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
  whatsapp = false,
  whatsappEnabled,
  waRows = [],
  optedIn = true,
} = {}) {
  const calls = [],
    updates = [],
    sent = [];
  let connections = 0;
  const db = {
    rpc: async (name) => {
      calls.push(name);
      return {
        data:
          name === "claim_notification_emails"
            ? rows.splice(0, 1)
            : name === "claim_notification_whatsapp"
              ? waRows.splice(0, 1)
              : null,
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
          maybeSingle: async () => ({
            data: {
              whatsapp_opt_in: optedIn,
              whatsapp_number: "+5544999999999",
            },
            error: null,
          }),
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
    ...(whatsappEnabled === undefined
      ? {}
      : { WHATSAPP_ENABLED: whatsappEnabled }),
    CRON_SECRET: "local-test-secret",
    NOTIFICATIONS_ENABLED: enabled,
    ...(whatsapp
      ? {
          WHATSAPP_ENABLED: "true",
          WHATSAPP_API_TOKEN: "fake-meta-token",
          WHATSAPP_PHONE_NUMBER_ID: "123456789",
          WHATSAPP_API_VERSION: "v99.0",
          WHATSAPP_TEMPLATE_NAME: "fixture_template",
        }
      : {}),
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
  assert.deepEqual(w.calls, [
    "enqueue_deadline_notifications",
    "enqueue_consultation_reminders",
  ]);
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

test("WhatsApp requires opt-in and uses only the fixed official API with approved template fields", async () => {
  const notice = {
    id: "notice-wa",
    recipient_id: "client",
    title: "Aguardando assinatura",
  };
  const w = worker({ enabled: "true", whatsapp: true, waRows: [notice] });
  await w.run();
  assert.equal(w.sent.length, 1);
  assert.equal(
    w.sent[0].url,
    "https://graph.facebook.com/v99.0/123456789/messages",
  );
  const body = JSON.parse(w.sent[0].options.body);
  assert.equal(body.type, "template");
  assert.equal(body.to, "5544999999999");
  assert.equal(
    body.template.components[0].parameters[1].text,
    "https://example.test/area-cliente",
  );
  assert.ok(w.updates.some((u) => u.whatsapp_status === "sent"));
  const denied = worker({
    enabled: "true",
    whatsapp: true,
    optedIn: false,
    waRows: [notice],
  });
  await denied.run();
  assert.equal(denied.sent.length, 0);
  assert.ok(denied.updates.some((u) => u.whatsapp_status === "skipped"));
});
test("WhatsApp failures are terminal pending manual verification, avoiding ambiguous retries", async () => {
  const w = worker({
    enabled: "true",
    whatsapp: true,
    responseCode: 503,
    waRows: [{ id: "notice", recipient_id: "client", title: "Aviso" }],
  });
  await w.run();
  assert.ok(w.updates.some((u) => u.whatsapp_status === "failed"));
  assert.equal(w.sent.length, 1);
});

test("absent or false WhatsApp flag never claims Meta queue and does not block email", async () => {
  for (const whatsappEnabled of [undefined, "false"]) {
    const w = worker({
      enabled: "true",
      whatsappEnabled,
      rows: [
        {
          id: "email-only",
          recipient_id: "client",
          title: "Análise concluída",
          body: "Agende sua consultoria",
          attempts: 1,
        },
      ],
      waRows: [{ id: "never-send" }],
    });
    const result = await w.run();
    assert.equal(result.body.sent, 1);
    assert.equal(result.body.whatsapp, "disabled");
    assert(!w.calls.includes("claim_notification_whatsapp"));
    assert.equal(w.sent.length, 1);
    assert.equal(w.sent[0].url, "https://api.resend.com/emails");
  }
});
