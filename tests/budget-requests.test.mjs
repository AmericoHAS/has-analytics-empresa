import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

function load(file, imports) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    Buffer,
    require: (id) => {
      if (!(id in imports)) throw new Error(`Unexpected import ${id}`);
      return imports[id];
    },
  });
  return exports;
}
const schema = load("lib/budget-request.ts", { zod: { z } });
const valid = {
  id: "8786e7bd-3baf-4f9c-bb4d-e016304d4a93",
  name: " Cliente de teste ",
  email: " TESTE@example.test ",
  phone: "(44) 99999-8888",
  service_type: "Consultoria estatística",
  title: "Uma pesquisa de teste",
  description: "Preciso organizar os dados experimentais de uma pesquisa.",
  desired_date: "2028-02-29",
  consent: true,
  website: "",
};
function route(error = null) {
  const rows = [];
  const api = load("app/api/orcamento/route.ts", {
    "@/lib/budget-request": schema,
    "next/server": {
      NextResponse: {
        json: (body, options) => ({ body, status: options?.status ?? 200 }),
      },
    },
    "@/lib/supabase/server": {
      createClient: async () => ({
        from: (table) => ({
          insert: async (row) => {
            rows.push({ table, row });
            return { error };
          },
        }),
      }),
    },
  });
  return {
    rows,
    send: (payload, contentType = "application/json") =>
      api.POST(
        new Request("https://example.test/api/orcamento", {
          method: "POST",
          headers: { "content-type": contentType },
          body: typeof payload === "string" ? payload : JSON.stringify(payload),
        }),
      ),
  };
}
test("budget submission normalizes contacts and keeps access as a request", async () => {
  const r = route();
  assert.equal((await r.send(valid)).status, 200);
  assert.equal(r.rows[0].table, "budget_requests");
  assert.equal(r.rows[0].row.email, "teste@example.test");
  assert.equal(r.rows[0].row.name, "Cliente de teste");
  assert.equal(r.rows[0].row.status, "nova");
  assert.match(r.rows[0].row.description, /acesso à área do cliente/);
});
test("invalid input, false consent and impossible dates never reach persistence", async () => {
  const r = route();
  for (const bad of [
    { email: "invalid" },
    { consent: false },
    { desired_date: "2027-02-29" },
    { description: "curta" },
    { phone: "abc" },
    { website: "bot.test" },
    { service_type: "injected" },
    { id: "invalid" },
  ]) {
    assert.equal((await r.send({ ...valid, ...bad })).status, 400);
  }
  assert.equal(r.rows.length, 0);
});
test("malformed and oversized request bodies are rejected", async () => {
  const r = route();
  assert.equal((await r.send("not json")).status, 400);
  assert.equal((await r.send("x".repeat(24001))).status, 413);
  assert.equal((await r.send(valid, "text/plain")).status, 415);
  assert.equal(r.rows.length, 0);
});
test("duplicate retries succeed while database failures remain retryable", async () => {
  assert.equal((await route({ code: "23505" }).send(valid)).status, 200);
  const result = await route({
    code: "42501",
    message: "private diagnostic",
  }).send(valid);
  assert.equal(result.status, 503);
  assert(!result.body.message.includes("private diagnostic"));
});
test("status changes verify session and admin role before privileged access", async () => {
  for (const role of [null, "client", "admin"]) {
    let writes = 0;
    const action = load("app/admin/request-actions.ts", {
      zod: { z },
      "next/cache": { revalidatePath: () => {} },
      "@/lib/supabase/server": {
        createClient: async () => ({
          auth: {
            getClaims: async () => ({
              data: role ? { claims: { sub: "admin-id" } } : null,
            }),
          },
          from: () => ({
            select: () => ({
              eq: () => ({ single: async () => ({ data: { role } }) }),
            }),
          }),
        }),
      },
      "@/lib/supabase/admin": {
        createAdminClient: () => {
          writes++;
          return {
            from: () => ({
              update: () => ({
                eq: () => ({
                  select: () => ({
                    single: async () => ({ data: { id: valid.id } }),
                  }),
                }),
              }),
            }),
          };
        },
      },
    });
    assert.equal(
      (await action.updateRequestStatus(valid.id, "em_analise")).success,
      role === "admin",
    );
    assert.equal(writes, role === "admin" ? 1 : 0);
    assert.equal(
      (await action.updateRequestStatus(valid.id, "invalid")).success,
      false,
    );
  }
});
