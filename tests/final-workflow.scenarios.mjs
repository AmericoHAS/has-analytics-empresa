import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Uses ONLY the in-memory PostgreSQL created by sql.integration.mjs.
export async function runFinalWorkflow({
  db,
  as,
  denied,
  admin,
  a,
  b,
  dataFirst = false,
}) {
  const row = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  const facts = async (id) =>
    (await row(`select facts from client_lifecycle('${a}','${id}')`)).facts;
  async function upload(
    pid,
    kind,
    revision = null,
    visible = true,
    owner = admin,
  ) {
    await as(owner);
    const path = `${a}/${randomUUID()}.pdf`;
    await db.query(
      "insert into storage.objects(bucket_id,name) values('client-documents',$1)",
      [path],
    );
    return await row(
      "insert into client_documents(client_id,project_id,revision_id,title,kind,storage_path,is_visible) values($1,$2,$3,'Arquivo de teste',$4,$5,$6) returning id,storage_path",
      [a, pid, revision, kind, path, visible],
    );
  }
  async function meeting(pid, revision = null, offset = 150) {
    await as(admin);
    const s = await row(
      `insert into consultation_slots(starts_at,ends_at,mode) values(now()+interval '${offset} days',now()+interval '${offset} days 1 hour','online') returning id`,
    );
    await as(a);
    await db.exec(
      `select book_consultation('${s.id}','${pid}',${revision ? `'${revision}'` : "null"})`,
    );
    const booking = await row(
      `select id from consultation_bookings where slot_id='${s.id}'`,
    );
    await as(admin);
    await db.exec(
      `insert into client_projects(client_id,title,status,analysis_completed_at) values('${b}','Outro cliente elegível','em_andamento',now())`,
    );
    await as(b);
    assert.equal(
      (
        await db.query(
          `select * from consultation_bookings where id='${booking.id}'`,
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (await db.query(`select * from consultation_slots where id='${s.id}'`))
        .rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          `select * from list_consultation_slots() where id='${s.id}'`,
        )
      ).rows.length,
      0,
    );
    await as(admin);
    await denied(
      `update consultation_slots set starts_at=starts_at+interval '5 minutes' where id='${s.id}'`,
    );
    await db.exec(
      `select manage_consultation('${booking.id}','confirmado','https://meet.google.com/abc-defg-hij','')`,
    );
    await denied(`select manage_consultation('${booking.id}','concluido')`);
    // Advance the isolated fixture's meeting time; production guard remains tested above.
    await db.exec(
      `reset role;alter table consultation_slots disable trigger guard_consultation_slot;update consultation_slots set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id='${s.id}';alter table consultation_slots enable trigger guard_consultation_slot;`,
    );
    await as(admin);
    await db.exec(`select manage_consultation('${booking.id}','concluido')`);
    return booking.id;
  }
  await db.exec(
    `reset role;update auth.users set email='fixture@example.test' where id='${a}';update budget_requests set created_at=now()-interval '1 day' where client_id='${a}';`,
  );
  await as(a);
  await as("", "anon");
  const quick = randomUUID();
  await db.exec(
    `insert into budget_requests(id,name,email,service_type,title,description) values('${quick}','Visitante','visitante@example.test','Bioestatística e pesquisa','Solicitação pública','Descrição fictícia para testar o aviso interno ao admin.')`,
  );
  await as(admin);
  assert.equal(
    (
      await row(
        `select count(*)::int n from notifications where event_key='quote-request:${quick}' and recipient_id='${admin}' and client_id is null`,
      )
    ).n,
    1,
  );
  await as(a);
  await denied(`select budget_client_contact('${b}')`);
  await as(admin);
  assert.equal(
    (await row(`select budget_client_contact('${a}') contact`)).contact.email,
    "fixture@example.test",
  );
  await as(a);
  const request = randomUUID();
  const pid = (
    await row(
      `select submit_quote_request('${request}','Cliente teste','44999999999','Bioestatística e pesquisa','Projeto final fictício','Analisar o banco experimental de demonstração.',null) id`,
    )
  ).id;
  await as(admin);
  assert.ok(
    (
      await row(
        `select count(*)::int n from notifications where event_key='quote-request:${request}'`,
      )
    ).n > 0,
  );
  const details = {
    legal_name: "Nome revisado",
    tax_id: "12345678901",
    email: "fixture@example.test",
    phone: "44999999999",
    address: "Rua de teste 10",
    city: "Maringá",
    state: "PR",
    postal_code: "87000000",
    institution: "Instituição",
    representative: "",
  };
  const payload = {
    clientId: a,
    projectId: pid,
    requestId: request,
    title: "Proposta final",
    description: "Escopo revisado",
    notes: "Condições acordadas",
    items: [
      { description: "Organizar", quantity: 1, unitPrice: 30 },
      { description: "Analisar", quantity: 1, unitPrice: 60 },
      { description: "Relatório", quantity: 1, unitPrice: 10 },
    ],
    discountPercent: 30,
    clientDetails: details,
  };
  const budget = (
    await row("select save_client_budget_v3($1::jsonb) id", [
      JSON.stringify(payload),
    ])
  ).id;
  assert.deepEqual(
    (
      await row(
        `select client_details from client_budgets where id='${budget}'`,
      )
    ).client_details,
    details,
  );
  const rev = (
    await row(`select revision from client_budgets where id='${budget}'`)
  ).revision;
  const snap = {
    provider: {
      provider_name: "HAS Teste",
      provider_tax_id: "12345678901",
      provider_address: "Rua de teste",
    },
    template: {
      engine: "has-native-v1",
      pixKey: "chave-ficticia",
      paymentInstructions: "Pix demonstrativo",
    },
  };
  async function commercial(kind) {
    await as(admin);
    const id = randomUUID();
    await db.exec(
      `insert into storage.objects(bucket_id,name) values('commercial-documents','${a}/${id}/document.pdf'),('commercial-documents','${a}/${id}/editable.docx')`,
    );
    await db.query(
      `insert into commercial_documents(id,client_id,budget_id,kind,title,body,snapshot,source_revision,pdf_path,word_path,payment_option,offer_group) values($1,$2,$3,$4,'Documento fictício','Termos',$5,$6,$7,$8,$9,$10)`,
      [
        id,
        a,
        budget,
        kind,
        JSON.stringify(snap),
        rev,
        `${a}/${id}/document.pdf`,
        `${a}/${id}/editable.docx`,
        kind === "orcamento"
          ? JSON.stringify({ total: 70, label: "Pix", installments: 1 })
          : null,
        kind === "orcamento" ? randomUUID() : null,
      ],
    );
    return id;
  }
  const proposal = await commercial("orcamento");
  await db.exec(`select publish_commercial_document('${proposal}')`);
  assert.equal((await facts(pid)).proposalSent, true);
  await as(a);
  await db.exec(
    `select choose_payment_offer('${proposal}');select decide_commercial_document('${proposal}',true,'Aceito')`,
  );
  const payment = (
    await row(`select id from budget_payments where budget_id='${budget}'`)
  ).id;
  const signature = `${a}/signatures/${randomUUID()}.pdf`;
  await db.query(
    "insert into storage.objects(bucket_id,name) values('commercial-documents',$1)",
    [signature],
  );
  await db.query("select submit_signed_commercial($1,$2)", [
    proposal,
    signature,
  ]);
  await as(admin);
  await db.exec(`select review_commercial_signature('${proposal}',true)`);
  const contract = await commercial("contrato");
  await denied(`select publish_commercial_document('${contract}')`);
  await db.exec(
    `select register_provider_signature('${contract}','${a}/${contract}/document.pdf');select publish_commercial_document('${contract}')`,
  );
  await as(a);
  const receipt = `${a}/${randomUUID()}.pdf`;
  await db.query(
    "insert into storage.objects(bucket_id,name) values('payment-receipts',$1)",
    [receipt],
  );
  const contractSignature = `${a}/signatures/${randomUUID()}.pdf`;
  await db.query(
    "insert into storage.objects(bucket_id,name) values('commercial-documents',$1)",
    [contractSignature],
  );
  await db.query("select submit_contract_package($1,$2,$3)", [
    contract,
    contractSignature,
    receipt,
  ]);
  await denied(`select manage_budget_payment('${payment}','confirmar')`);
  await denied(`select complete_project_analysis('${pid}',null)`);
  if (dataFirst) await upload(pid, "arquivo", null, true, a);
  await as(admin);
  await denied(`select manage_budget_payment('${payment}','confirmar')`);
  await db.exec(
    `select review_commercial_signature('${contract}',true);select manage_budget_payment('${payment}','confirmar')`,
  );
  assert.equal(
    (await row(`select status from client_projects where id='${pid}'`)).status,
    dataFirst ? "em_andamento" : "solicitado",
  );
  await upload(pid, "arquivo", null, true, a);
  await as(admin);
  assert.equal(
    (await row(`select status from client_projects where id='${pid}'`)).status,
    "em_andamento",
  );
  assert.equal((await facts(pid)).analysis, true);
  await db.exec(`update client_projects set progress=42 where id='${pid}'`);
  await upload(pid, "arquivo", null, true, a);
  await as(admin);
  assert.equal(
    (await row(`select progress from client_projects where id='${pid}'`))
      .progress,
    42,
  );
  assert.equal(
    (
      await row(
        `select count(*)::int n from notifications where event_key='analysis-start:${pid}'`,
      )
    ).n,
    1,
  );
  await denied(`select archive_client_budget('${budget}')`);
  await denied(`select delete_client_project('${pid}','${a}')`);
  await denied(`delete from client_projects where id='${pid}'`);
  await denied(`select close_analysis_project('${pid}')`);
  await denied(`select complete_project_analysis('${pid}')`);
  const hidden = await upload(pid, "relatorio", null, false);
  await as(a);
  assert.equal(
    (await db.query(`select * from client_documents where id='${hidden.id}'`))
      .rows.length,
    0,
  );
  assert.equal(
    (
      await db.query("select * from storage.objects where name=$1", [
        hidden.storage_path,
      ])
    ).rows.length,
    0,
  );
  await as(admin);
  await denied(`select complete_project_analysis('${pid}')`);
  await db.exec(
    `update client_documents set is_visible=true where id='${hidden.id}'`,
  );
  assert.equal((await facts(pid)).results, true);
  assert.equal((await facts(pid)).analysisCompleted, false);
  const free = (
    await row(
      `insert into consultation_slots(starts_at,ends_at,mode) values(now()+interval '${dataFirst ? 181 : 180} days',now()+interval '${dataFirst ? 181 : 180} days 1 hour','online') returning id`,
    )
  ).id;
  await as(a);
  await denied(`select book_consultation('${free}','${pid}',null)`);
  await as(admin);
  await db.exec(
    `select complete_project_analysis('${pid}');select complete_project_analysis('${pid}')`,
  );
  assert.equal((await facts(pid)).analysisCompleted, true);
  assert.equal(
    (
      await row(
        `select count(*)::int n from notifications where event_key='analysis-complete:${pid}'`,
      )
    ).n,
    1,
  );
  await as(b);
  await denied(`select complete_project_analysis('${pid}')`);
  assert.equal(
    (await db.query(`select * from client_lifecycle('${a}','${pid}')`)).rows
      .length,
    0,
  );
  await meeting(pid);
  assert.equal(
    (await row(`select status from client_projects where id='${pid}'`)).status,
    "em_andamento",
  );
  assert.equal((await facts(pid)).meetingDone, true);
  assert.equal((await facts(pid)).completed, false);
  await denied(`select close_analysis_project('${pid}')`); // receipt still missing
  const revision = (
    await row(
      `insert into project_revisions(project_id,title,enabled) values('${pid}','Revisão solicitada',true) returning id`,
    )
  ).id;
  assert.equal((await facts(pid)).analysisCompleted, false);
  await upload(pid, "relatorio", revision);
  await as(a);
  await denied(`select book_consultation('${free}','${pid}','${revision}')`);
  await as(admin);
  await db.exec(`select complete_project_analysis('${pid}','${revision}')`);
  await meeting(pid, revision, 151);
  const paidDoc = await commercial("recibo");
  await db.exec(
    `select publish_commercial_document('${paidDoc}');select close_analysis_project('${pid}')`,
  );
  assert.equal((await facts(pid)).completed, true);
  await db.exec(
    `select archive_client_budget('${budget}');select archive_analysis_project('${pid}')`,
  );
  assert.equal(
    (await row(`select status from budget_payments where id='${payment}'`))
      .status,
    "confirmado",
  );
  assert.ok(
    (await row(`select archived_at from client_budgets where id='${budget}'`))
      .archived_at,
  );
  assert.equal(
    (await row(`select project_id from client_budgets where id='${budget}'`))
      .project_id,
    pid,
  );
  assert.equal(
    (await db.query(`select * from client_lifecycle('${a}','${pid}')`)).rows
      .length,
    0,
  );
  await db.exec(`select archive_analysis_project('${pid}',false)`);
  await assert.rejects(() =>
    db.query("select save_client_budget_v3($1::jsonb)", [
      JSON.stringify({ ...payload, id: budget }),
    ]),
  );
  const empty = (
    await row(
      `insert into client_projects(client_id,title) values('${a}','Teste descartável') returning id`,
    )
  ).id;
  assert.equal(
    (await row(`select delete_client_project('${empty}','${a}') ok`)).ok,
    true,
  );
  console.log(
    "PASS final end-to-end: request, revised proposal, signature, contract, payment, automatic analysis, manual progress, explicit results, calendar, revision, receipt, closure, archive and safe deletion",
  );
  console.log(
    "PASS final permissions: other clients, admin RPCs, private drafts/storage, premature bookings, duplicate notices and preserved paid history",
  );
}
