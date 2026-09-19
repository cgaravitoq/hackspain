import { env, SELF } from "cloudflare:test";
import {
  companyRelationsSchema,
  type Graph,
  graphSchema,
  relationsArtifactSchema,
} from "@hackspain/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { seed } from "./fixtures.ts";
import { relationsJson, seedRelations } from "./relations.ts";

const artifact = relationsArtifactSchema.parse(
  JSON.parse(JSON.stringify(relationsJson)),
);

beforeAll(async () => {
  await seed(env.DB);
  await seedRelations(env.DB, artifact);
});

async function graph(query = ""): Promise<Graph> {
  const response = await SELF.fetch(`https://agent.test/graph${query}`);
  expect(response.status).toBe(200);
  return graphSchema.parse(await response.json());
}

describe("the relations artifact the loader reads", () => {
  it("accepts the fixture with its meta, calibration, nodes and edges", () => {
    expect(artifact.meta.rule_version).toBe("xray-relations/0.1");
    expect(artifact.calibration.bank_flows_observed_min_2).toEqual({
      intragroup: 41,
      intergroup: 7,
    });
    expect(artifact.nodes.map((node) => node.company_id)).toEqual([
      "COMP_A",
      "COMP_B",
      "COMP_D",
      "COMP_E",
    ]);
    expect(artifact.edges).toHaveLength(3);
  });

  it("rejects a relations artifact with an unknown relation type", () => {
    const result = relationsArtifactSchema.safeParse({
      ...relationsJson,
      edges: [{ ...relationsJson.edges[0], relation_type: "OWNS" }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["edges", 0, "relation_type"],
    ]);
  });
});

describe("GET /graph", () => {
  it("serves every relation with the score and state of each company's latest month", async () => {
    const body = await graph();
    expect(body.meta).toEqual(artifact.meta);
    expect(
      body.nodes.find((node) => node.company_id === "COMP_A"),
    ).toMatchObject({ score: 12.3, state: "falling", scorable: true });
    expect(body.edges.map((edge) => edge.relation_type)).toEqual([
      "INFERRED_PAYMENT_TO",
      "SHARES_COUNTERPARTY_WITH",
      "OPEN_OBLIGATION_TO",
    ]);
    expect(body.edges.map((edge) => edge.matches)).toEqual([12, 3, 1]);
  });

  it("keeps only the edges of the requested relation type", async () => {
    const body = await graph("?type=SHARES_COUNTERPARTY_WITH");
    expect(body.edges.map((edge) => edge.relation_type)).toEqual([
      "SHARES_COUNTERPARTY_WITH",
    ]);
  });

  it("treats confidence as a minimum, dropping low at medium and keeping only high at high", async () => {
    const medium = await graph("?confidence=medium");
    expect(medium.edges.map((edge) => edge.confidence)).toEqual([
      "high",
      "medium",
    ]);
    const high = await graph("?confidence=high");
    expect(high.edges.map((edge) => edge.confidence)).toEqual(["high"]);
  });

  it("keeps only the edges of the requested scope", async () => {
    const body = await graph("?scope=intergroup");
    expect(body.edges.map((edge) => edge.scope)).toEqual([
      "intergroup",
      "intergroup",
    ]);
  });

  it("returns only the nodes and the internal edges of one group", async () => {
    const body = await graph("?group_id=GROUP_1");
    expect(body.nodes.map((node) => node.company_id)).toEqual([
      "COMP_A",
      "COMP_B",
    ]);
    expect(body.edges.map((edge) => edge.source)).toEqual(["COMP_A"]);
  });

  it("omits isolated companies unless include_isolated is true", async () => {
    const withoutIsolated = await graph();
    expect(withoutIsolated.nodes.map((node) => node.company_id)).toEqual([
      "COMP_A",
      "COMP_B",
      "COMP_D",
    ]);
    const withIsolated = await graph("?include_isolated=true");
    expect(withIsolated.nodes.map((node) => node.company_id)).toEqual([
      "COMP_A",
      "COMP_B",
      "COMP_D",
      "COMP_E",
    ]);
    expect(withIsolated.edges).toHaveLength(3);
    expect(withIsolated.edges).toEqual(withoutIsolated.edges);
    expect(
      withIsolated.nodes.find((node) => node.company_id === "COMP_E"),
    ).toMatchObject({
      degree: 0,
      role: "isolated",
      score: null,
      state: "not_evaluable",
      scorable: false,
    });
  });

  it("rejects a relation type outside the contract", async () => {
    const response = await SELF.fetch("https://agent.test/graph?type=OWNS");
    expect(response.status).toBe(400);
  });

  it("answers 404 while the relations artifact has not been loaded", async () => {
    await env.DB.prepare(
      "DELETE FROM documents WHERE name = 'relations_meta'",
    ).run();
    const response = await SELF.fetch("https://agent.test/graph");
    expect(response.status).toBe(404);
    await env.DB.prepare(
      "INSERT INTO documents (name, payload) VALUES ('relations_meta', ?1)",
    )
      .bind(JSON.stringify(artifact.meta))
      .run();
  });
});

describe("GET /companies/:id/relations", () => {
  it("returns the relations of a company with the counterpart score and state", async () => {
    const response = await SELF.fetch(
      "https://agent.test/companies/COMP_A/relations",
    );
    expect(response.status).toBe(200);
    const body = companyRelationsSchema.parse(await response.json());
    expect(body.edges.map((edge) => edge.counterpart_company_id)).toEqual([
      "COMP_B",
      "COMP_D",
    ]);
    expect(body.edges.map((edge) => edge.counterpart_state)).toEqual([
      "healthy",
      "slipping",
    ]);
    expect(body.edges[0]?.counterpart_score).toBe(91);
  });

  it("returns an empty edge list for a known company with no relation", async () => {
    const response = await SELF.fetch(
      "https://agent.test/companies/COMP_E/relations",
    );
    expect(response.status).toBe(200);
    const body = companyRelationsSchema.parse(await response.json());
    expect(body.company_id).toBe("COMP_E");
    expect(body.edges).toEqual([]);
  });

  it("answers 404 with the same shape as /companies/:id for an unknown company", async () => {
    const relations = await SELF.fetch(
      "https://agent.test/companies/COMP_X/relations",
    );
    expect(relations.status).toBe(404);
    const company = await SELF.fetch("https://agent.test/companies/COMP_X");
    expect(company.status).toBe(404);
    expect(await relations.json()).toEqual(await company.json());
  });
});
