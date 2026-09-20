import { env, SELF } from "cloudflare:test";
import { uploadBatchSchema, uploadsSchema } from "@hackspain/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { meta } from "./fixtures.ts";

const GROUPS = "group_id,erp\nG1,sap\nG2,navision\n";
const BALANCES = "product_id,company_id,balance\nP1,C1,10\n";
const TRANSACTIONS =
  "transaction_id,company_id,product_id,date,amount,status,category,description,counterparty_id\nT1,C1,P1,2026-01-01,10,settled,sales,Pago,CP1\n";

const errorSchema = z.object({ error: z.string() });

function form(parts: Record<string, string>): FormData {
  const body = new FormData();
  for (const [name, text] of Object.entries(parts)) {
    body.append(name, new File([text], `${name}.csv`, { type: "text/csv" }));
  }
  return body;
}

function post(body: FormData): Promise<Response> {
  return SELF.fetch("https://agent.test/uploads", { method: "POST", body });
}

async function keys(): Promise<string[]> {
  const listed = await env.BUCKET.list();
  return listed.objects.map((object) => object.key);
}

beforeEach(async () => {
  await env.BUCKET.delete(await keys());
});

describe("POST /uploads", () => {
  it("stores a batch and lists it newest first", async () => {
    const first = await post(form({ groups: GROUPS }));
    expect(first.status).toBe(201);
    const firstBatch = uploadBatchSchema.parse(await first.json());
    expect(firstBatch.files).toEqual([
      { name: "groups", rows: 2, bytes: GROUPS.length },
    ]);
    expect(firstBatch.batch_id).toMatch(/^\d{8}T\d{9}Z$/);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await post(form({ balances: BALANCES }));
    expect(second.status).toBe(201);
    const secondBatch = uploadBatchSchema.parse(await second.json());

    const listed = uploadsSchema.parse(
      await (await SELF.fetch("https://agent.test/uploads")).json(),
    );
    expect(listed.batches.map((batch) => batch.batch_id)).toEqual([
      secondBatch.batch_id,
      firstBatch.batch_id,
    ]);
    expect(listed.batches[1]?.files[0]?.rows).toBe(2);
    expect(listed.batches[0]?.files[0]?.rows).toBe(1);
    expect(await keys()).toEqual(
      expect.arrayContaining([
        `uploads/${firstBatch.batch_id}/groups.csv`,
        `uploads/${firstBatch.batch_id}/manifest.json`,
        `uploads/${secondBatch.batch_id}/balances.csv`,
        `uploads/${secondBatch.batch_id}/manifest.json`,
      ]),
    );
  });

  it("rejects a part whose name is not one of the seven files", async () => {
    const response = await post(form({ groups: GROUPS, customers: GROUPS }));
    expect(response.status).toBe(400);
    expect(errorSchema.parse(await response.json()).error).toBe(
      "Fichero no reconocido: customers",
    );
    expect(await keys()).toEqual([]);
  });

  it("rejects a file whose header lacks a required column", async () => {
    const response = await post(
      form({ groups: GROUPS, balances: "product_id,balance\nP1,10\n" }),
    );
    expect(response.status).toBe(400);
    expect(errorSchema.parse(await response.json()).error).toBe(
      "balances: faltan las columnas company_id",
    );
    expect(await keys()).toEqual([]);
  });

  it("rejects a body that is not multipart", async () => {
    const response = await SELF.fetch("https://agent.test/uploads", {
      method: "POST",
      body: "{}",
      headers: { "content-type": "application/json" },
    });
    expect(response.status).toBe(400);
    expect(errorSchema.parse(await response.json()).error).toBe(
      "Se esperaba multipart/form-data",
    );
  });
});

describe("GET /uploads", () => {
  it("reports pending when the newest batch is later than the loaded score", async () => {
    await env.DB.prepare(
      "INSERT INTO documents (name, payload) VALUES ('meta', ?1)",
    )
      .bind(JSON.stringify(meta))
      .run();

    const before = uploadsSchema.parse(
      await (await SELF.fetch("https://agent.test/uploads")).json(),
    );
    expect(before).toEqual({
      batches: [],
      scored_at: meta.generated_at,
      pending: false,
    });

    await post(form({ groups: GROUPS }));
    const after = uploadsSchema.parse(
      await (await SELF.fetch("https://agent.test/uploads")).json(),
    );
    expect(after.batches).toHaveLength(1);
    expect(after.scored_at).toBe(meta.generated_at);
    expect(after.pending).toBe(true);
  });

  it("reports no score and nothing pending when nothing is loaded or uploaded", async () => {
    await env.DB.prepare("DELETE FROM documents WHERE name = 'meta'").run();
    const uploads = uploadsSchema.parse(
      await (await SELF.fetch("https://agent.test/uploads")).json(),
    );
    expect(uploads).toEqual({ batches: [], scored_at: null, pending: false });
  });
});

describe("GET /uploads/:batch_id/:file", () => {
  it("serves a stored file back", async () => {
    const batch = uploadBatchSchema.parse(
      await (await post(form({ transactions: TRANSACTIONS }))).json(),
    );
    const response = await SELF.fetch(
      `https://agent.test/uploads/${batch.batch_id}/transactions`,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv");
    expect(await response.text()).toBe(TRANSACTIONS);
  });

  it("answers 404 for a file the batch does not carry", async () => {
    const batch = uploadBatchSchema.parse(
      await (await post(form({ groups: GROUPS }))).json(),
    );
    const response = await SELF.fetch(
      `https://agent.test/uploads/${batch.batch_id}/invoices`,
    );
    expect(response.status).toBe(404);
  });

  it("rejects a file name outside the seven inputs", async () => {
    const response = await SELF.fetch(
      "https://agent.test/uploads/20260920T000000000Z/customers",
    );
    expect(response.status).toBe(400);
  });
});
