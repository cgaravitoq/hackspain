import { describe, expect, it } from "vitest";
import {
  missingUploadColumns,
  uploadFileFor,
  uploadsSchema,
} from "./uploads.ts";

describe("uploadFileFor", () => {
  it("maps a filename that carries one of the seven inputs to that input", () => {
    expect(uploadFileFor("transactions.csv")).toBe("transactions");
    expect(uploadFileFor("transactions-2026-09.csv")).toBe("transactions");
    expect(uploadFileFor("2026-09_Banking_Products.csv")).toBe(
      "banking_products",
    );
  });

  it("refuses a filename that names none or several inputs", () => {
    expect(uploadFileFor("extract.csv")).toBeNull();
    expect(uploadFileFor("invoices_and_transactions.csv")).toBeNull();
  });
});

describe("missingUploadColumns", () => {
  it("accepts a header with every required column in any order plus extras", () => {
    expect(
      missingUploadColumns("groups", '\uFEFF"erp","group_id","name"\n'),
    ).toEqual([]);
  });

  it("names the required columns the header lacks", () => {
    expect(missingUploadColumns("balances", "product_id,amount")).toEqual([
      "company_id",
      "balance",
    ]);
  });
});

describe("uploadsSchema", () => {
  it("accepts a listing without a loaded score", () => {
    const parsed = uploadsSchema.safeParse({
      batches: [],
      scored_at: null,
      pending: false,
    });
    expect(parsed.success).toBe(true);
  });
});
