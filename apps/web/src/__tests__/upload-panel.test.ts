import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import UploadPanel from "../components/UploadPanel.vue";
import { uploadBatch, uploads } from "./fixtures.ts";

afterEach(() => vi.unstubAllGlobals());

type Call = { url: string; init: RequestInit | undefined };

const UPLOADED = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(uploadBatch.uploaded_at));

const SCORED = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(uploads.scored_at ?? ""));

function fakeUploads(
  listing = uploads,
  onPost: (init: RequestInit | undefined) => Response = () =>
    Response.json(uploadBatch, { status: 201 }),
) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      calls.push({ url: String(input), init });
      return Promise.resolve(
        init?.method === "POST" ? onPost(init) : Response.json(listing),
      );
    },
  );
  return calls;
}

async function choose(wrapper: VueWrapper, names: string[]) {
  const input = wrapper.find<HTMLInputElement>(
    'input[aria-label="Elegir ficheros CSV"]',
  );
  Object.defineProperty(input.element, "files", {
    configurable: true,
    value: names.map((name) => new File(["a,b\n1,2\n"], name)),
  });
  await input.trigger("change");
  await flushPromises();
}

function chosenInputs(wrapper: VueWrapper) {
  return wrapper.findAll(".chosen-input").map((item) => item.text());
}

describe("UploadPanel", () => {
  it("maps chosen filenames to the seven inputs and flags the rest", async () => {
    fakeUploads();
    const wrapper = mount(UploadPanel);
    await flushPromises();
    await choose(wrapper, [
      "transactions-2026-09.csv",
      "2026-09_balances.csv",
      "notas.csv",
      "invoices_and_transactions.csv",
      "transactions.csv",
    ]);
    expect(chosenInputs(wrapper)).toEqual([
      "transactions",
      "balances",
      "Nombre no reconocido",
      "Nombre no reconocido",
      "Duplicado",
    ]);
    const submit = wrapper.find("button.submit");
    expect(submit.text()).toBe("Subir");
    expect(submit.attributes("disabled")).toBeDefined();
    const removes = wrapper.findAll("button.remove");
    await removes[4]?.trigger("click");
    await removes[3]?.trigger("click");
    await removes[2]?.trigger("click");
    expect(chosenInputs(wrapper)).toEqual(["transactions", "balances"]);
    expect(
      wrapper.find("button.submit").attributes("disabled"),
    ).toBeUndefined();
  });

  it("posts the files under their input names and shows the created batch", async () => {
    const calls = fakeUploads();
    const wrapper = mount(UploadPanel);
    await flushPromises();
    await choose(wrapper, ["transactions.csv", "balances.csv"]);
    await wrapper.find("button.submit").trigger("click");
    await flushPromises();
    const post = calls.find((call) => call.init?.method === "POST");
    expect(post?.url).toBe("/api/uploads");
    const body = post?.init?.body;
    if (!(body instanceof FormData)) {
      throw new Error("expected a multipart body");
    }
    expect([...body.keys()]).toEqual(["transactions", "balances"]);
    const part = body.get("transactions");
    expect(part instanceof File && part.name).toBe("transactions.csv");
    expect(wrapper.find(".success").text()).toBe(
      `Lote ${UPLOADED}: 2 ficheros, 13.766 filas`,
    );
    expect(wrapper.findAll(".chosen li")).toHaveLength(0);
    expect(
      calls.filter(
        (call) => call.url === "/api/uploads" && call.init?.method !== "POST",
      ),
    ).toHaveLength(2);
  });

  it("shows the server error verbatim when the upload is rejected", async () => {
    fakeUploads(uploads, () =>
      Response.json(
        { error: "transactions.csv: falta la columna amount" },
        { status: 400 },
      ),
    );
    const wrapper = mount(UploadPanel);
    await flushPromises();
    await choose(wrapper, ["transactions.csv"]);
    await wrapper.find("button.submit").trigger("click");
    await flushPromises();
    expect(wrapper.find(".error").text()).toBe(
      "transactions.csv: falta la columna amount",
    );
    expect(wrapper.findAll(".chosen li")).toHaveLength(1);
  });

  it("shows the pending banner when the score predates the newest upload", async () => {
    fakeUploads();
    const wrapper = mount(UploadPanel);
    await flushPromises();
    const banner = wrapper.find('[role="status"].banner');
    expect(banner.text()).toBe(
      `Pendiente de recalcular: hay datos subidos el ${UPLOADED} posteriores al último cálculo (${SCORED})`,
    );
    expect(banner.classes()).toContain("pending");
    expect(wrapper.findAll("tbody tr")).toHaveLength(1);
    expect(wrapper.findAll("tbody td").map((cell) => cell.text())).toEqual([
      UPLOADED,
      "transactions (12.480 filas), balances (1.286 filas)",
      "2,5 MB",
    ]);
  });

  it("reports the score as current when nothing newer was uploaded", async () => {
    fakeUploads({ ...uploads, pending: false });
    const wrapper = mount(UploadPanel);
    await flushPromises();
    expect(wrapper.find(".banner").text()).toBe(
      `Score al día: calculado el ${SCORED} con todos los datos subidos`,
    );
    fakeUploads({ batches: [], scored_at: null, pending: false });
    const empty = mount(UploadPanel);
    await flushPromises();
    expect(empty.find(".banner").text()).toBe("Aún no se han subido datos");
    expect(empty.find("table").exists()).toBe(false);
    expect(empty.find(".empty").text()).toBe("Sin lotes todavía");
  });
});
