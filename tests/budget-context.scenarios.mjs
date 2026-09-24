import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
export async function runBudgetContext({ db, as, denied, admin, a, b }) {
  await db.exec("reset role");
  const sql = readFileSync("supabase/ATUALIZAR-CONTEXTO-ORCAMENTO.sql", "utf8");
  await db.exec(sql);
  await db.exec(sql);
  const payload = {
    clientId: a,
    projectId: "",
    title: "Proposta de contexto",
    description: "Descrição",
    notes: "",
    validUntil: "",
    discountPercent: 0,
    requestDetails: {
      purpose: "Dissertação",
      department: "Programa de pesquisa",
      urgency: "Prazo definido",
    },
    items: [{ description: "Etapa interna", quantity: 1, unitPrice: 100 }],
  };
  const command = (p) =>
    `select save_client_budget_with_context('${JSON.stringify(p).replaceAll("'", "''")}'::jsonb) id`;
  await as(b);
  await denied(command(payload));
  await as(admin);
  const id = (await db.query(command(payload))).rows[0].id;
  let row = (
    await db.query(
      `select request_details,revision from client_budgets where id='${id}'`,
    )
  ).rows[0];
  assert.equal(row.request_details.purpose, "Dissertação");
  const revision = row.revision;
  const changed = {
    ...payload,
    id,
    requestDetails: {
      ...payload.requestDetails,
      purpose: "Tese",
      department: "",
    },
  };
  await db.query(command(changed));
  row = (
    await db.query(
      `select request_details,revision from client_budgets where id='${id}'`,
    )
  ).rows[0];
  assert.equal(row.request_details.department, "");
  assert.equal(row.request_details.purpose, "Tese");
  assert.ok(row.revision > revision);
  await denied(command({ ...changed, requestDetails: [] }));
  assert.equal(
    (
      await db.query(
        `select request_details from client_budgets where id='${id}'`,
      )
    ).rows[0].request_details.purpose,
    "Tese",
  );
  await db.exec(`update client_budgets set archived_at=now() where id='${id}'`);
  await denied(command(changed));
  await as(b);
  assert.equal(
    (
      await db.query(
        `select request_details from client_budgets where id='${id}'`,
      )
    ).rows.length,
    0,
  );
  await db.exec("reset role");
  await db.exec(
    `update auth.users set email='shared-services@example.test' where id='${b}'`,
  );
  for (const [index, service] of [
    "Consultoria estatística",
    "Ciência de dados e indicadores",
    "Desenvolvimento digital",
    "Comunicação e educação",
    "Quero orientação sobre meu projeto",
    "Bioestatística e pesquisa",
  ].entries()) {
    await db.exec("reset role");
    await db.exec(
      `update budget_requests set created_at=now()-interval '5 minutes' where client_id='${b}'`,
    );
    await as(b);
    const requestId = `b2300000-0000-4000-8000-00000000000${index}`;
    const result = await db.query(
      `select submit_quote_request('${requestId}','Cliente Serviços','','${service}','Projeto de pesquisa','Descrição detalhada de pesquisa para orçamento',current_date+30) id`,
    );
    assert.ok(result.rows[0].id);
  }
  console.log(
    "PASS proposal context: atomic save, reopened reviewed/cleared fields, revision invalidation, admin-only changes, archive protection, client isolation",
  );
}
