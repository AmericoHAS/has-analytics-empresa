import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
export async function runOnboarding({ db, as, denied, admin, a, b }) {
  await db.exec("reset role");
  await db.exec(
    `update auth.users set email='onboarding@example.test' where id='${a}';`,
  );
  const request = "a2300000-0000-4000-8000-000000000001";
  const legacy = "a2300000-0000-4000-8000-000000000002";
  await db.exec(
    `insert into budget_requests(id,client_id,name,email,service_type,title,description) values('${legacy}','${a}','Legacy','onboarding@example.test','Pesquisa','Projeto já vinculado','Descrição de projeto legado'),('${request}',null,'Novo','ONBOARDING@example.test','Pesquisa','Projeto primeiro acesso','Descrição da pesquisa solicitada');`,
  );
  const sql = readFileSync("supabase/ATUALIZAR-PRIMEIRO-ACESSO.sql", "utf8");
  await db.exec(sql);
  const legacyProject = (
    await db.query(
      `select project_id from budget_requests where id='${legacy}'`,
    )
  ).rows[0].project_id;
  assert.ok(legacyProject);
  await db.exec(sql);
  assert.equal(
    (
      await db.query(
        `select project_id from budget_requests where id='${legacy}'`,
      )
    ).rows[0].project_id,
    legacyProject,
  );
  await as(a);
  await denied(`select link_budget_request_by_email('${request}')`);
  await denied(`insert into client_onboarding(client_id) values('${b}')`);
  await db.exec("reset role");
  await db.exec(
    `delete from client_onboarding where client_id='${b}'; delete from client_billing_profiles where client_id='${b}';`,
  );
  await as(b);
  await denied("select complete_client_onboarding()");
  await as(admin);
  assert.equal(
    (await db.query(`select link_budget_request_by_email('${request}') cid`))
      .rows[0].cid,
    a,
  );
  const pid = (
    await db.query(
      `select project_id from budget_requests where id='${request}'`,
    )
  ).rows[0].project_id;
  assert.ok(pid);
  await db.query(`select link_budget_request_by_email('${request}')`);
  assert.equal(
    (
      await db.query(
        `select project_id from budget_requests where id='${request}'`,
      )
    ).rows[0].project_id,
    pid,
  );
  await as(a);
  assert.equal(
    (await db.query(`select title from client_projects where id='${pid}'`))
      .rows[0].title,
    "Projeto primeiro acesso",
  );
  await as(b);
  assert.equal(
    (await db.query(`select id from client_projects where id='${pid}'`)).rows
      .length,
    0,
  );
  await db.exec(
    `insert into client_billing_profiles(client_id,legal_name,tax_id,email,phone,address,city,state,postal_code,institution,representative) values('${b}','Cliente Teste','12345678901','fixture@example.test','44999999999','Rua Teste 10','Maringá','PR','87000000','','');`,
  );
  await db.exec(
    "select complete_client_onboarding(); select complete_client_onboarding();",
  );
  assert.equal(
    (await db.query("select * from client_onboarding")).rows.length,
    1,
  );
  await as(a);
  assert.equal(
    (await db.query(`select * from client_onboarding where client_id='${b}'`))
      .rows.length,
    0,
  );
  console.log(
    "PASS first access: validated one-time completion, no bypass writes, admin-only linking, legacy repair, idempotent projects and client isolation",
  );
}
