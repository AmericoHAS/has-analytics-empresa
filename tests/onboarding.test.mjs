import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
function load(file, deps = {}, globals = {}) {
  const exports = {};
  new Function(
    "exports",
    "require",
    ...Object.keys(globals),
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
  )(
    exports,
    (k) => {
      if (k in deps) return deps[k];
      throw Error("Unexpected import " + k);
    },
    ...Object.values(globals),
  );
  return exports;
}
function mail({
  status = 200,
  site = "https://portal.example.test",
  token = "one-time-hash",
} = {}) {
  const calls = [];
  const emailService = load(
    "lib/auth/client-access-email.ts",
    {
      "server-only": {},
      "node:crypto": { randomUUID },
      "@/lib/supabase/admin": {
        createAdminClient: () => ({
          auth: {
            admin: {
              getUserById: async () => ({
                data: { user: { email: "client@example.test" } },
              }),
              generateLink: async (args) => {
                calls.push(args);
                return { data: { properties: { hashed_token: token } } };
              },
            },
          },
        }),
      },
    },
    {
      process: {
        env: {
          RESEND_API_KEY: "fake-secret",
          RESEND_FROM_EMAIL: "HAS <test@example.test>",
          SITE_URL: site,
        },
      },
      fetch: async (url, args) => {
        calls.push({ url, ...args });
        return { ok: status === 200 };
      },
    },
  );
  return { ...emailService, calls };
}
test("first access email uses a one-time password setup link with the configured HTTPS origin", async () => {
  const m = mail();
  await m.sendClientAccessEmail("client");
  assert.deepEqual(m.calls[0], {
    type: "recovery",
    email: "client@example.test",
  });
  const payload = JSON.parse(m.calls[1].body);
  assert.deepEqual(payload.to, ["client@example.test"]);
  assert.match(
    payload.text,
    /https:\/\/portal.example.test\/auth\/confirm\?token_hash=one-time-hash&type=recovery&next=%2Fredefinir-senha/,
  );
  assert.match(payload.text, /primeiro acesso/);
  assert.equal(payload.text.includes("fake-secret"), false);
  assert.equal(m.calls.length, 2);
});
test("email failures are not reported as success; insecure origin prevents any provider/auth calls", async () => {
  const m = mail({ status: 503 });
  await assert.rejects(() => m.sendClientAccessEmail("client"), /não aceitou/);
  const unsafe = mail({ site: "http://portal.example.test" });
  await assert.rejects(() => unsafe.sendClientAccessEmail("client"), /HTTPS/);
  assert.equal(unsafe.calls.length, 0);
});
function actions({
  role = "admin",
  emailFails = false,
  linkFails = false,
} = {}) {
  const calls = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data:
              table === "profiles"
                ? { role }
                : { email: "client@example.test", client_id: null },
          }),
        }),
      }),
    }),
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { error: linkFails ? { message: "missing migration" } : null };
    },
  };
  const privileged = {
    auth: {
      admin: {
        createUser: async (data) => {
          calls.push({ create: data });
          return { data: { user: { id: "new-client" } } };
        },
      },
    },
    from: () => ({ upsert: async () => ({ error: null }) }),
  };
  const m = load("app/admin/actions.ts", {
    "node:crypto": { randomUUID },
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createClient: async () => db },
    "@/lib/supabase/admin": { createAdminClient: () => privileged },
    "@/lib/auth/client-access-email": {
      accessEmailConfig: () => ({}),
      sendClientAccessEmail: async () => {
        calls.push({ mail: true });
        if (emailFails) throw Error("Envio falhou");
      },
    },
  });
  return { ...m, calls };
}
function form() {
  const f = new FormData();
  Object.entries({
    fullName: "Cliente Teste",
    email: "client@example.test",
    phone: "44999999999",
    requestId: "request",
  }).forEach(([k, v]) => f.set(k, v));
  return f;
}
test("approval creates a random inaccessible password, links the requested project and sends setup email", async () => {
  const m = actions();
  const r = await m.createClientAction({}, form());
  assert.equal(r.success, true);
  assert.equal(r.clientId, "new-client");
  assert.equal(m.calls[0].create.password.length, 72);
  assert.equal(m.calls[1].name, "link_budget_request_by_email");
  assert.deepEqual(m.calls[1].args, { p_request_id: "request" });
  assert.equal(m.calls[2].mail, true);
});
test("non-admin cannot create accounts or trigger access emails", async () => {
  const m = actions({ role: "client" });
  assert.equal((await m.createClientAction({}, form())).success, false);
  assert.equal((await m.resendClientAccess("x")).success, false);
  assert.equal(m.calls.length, 0);
});
test("partial provisioning failures preserve created account and expose recovery feedback", async () => {
  const m = actions({ emailFails: true });
  const r = await m.createClientAction({}, form());
  assert.equal(r.success, false);
  assert.equal(r.clientId, "new-client");
  assert.match(r.message, /não cadastre novamente/);
  const link = actions({ linkFails: true });
  const result = await link.createClientAction({}, form());
  assert.equal(result.success, true);
  assert.match(result.message, /vínculo do projeto ficou pendente/);
});

