import { COMMITMENT_CONFIRMATION } from "@hackspain/shared";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ALERTS_LIMIT } from "../api.ts";
import ChatPanel from "../components/ChatPanel.vue";
import { alert, alerts } from "./fixtures.ts";

function sse(chunks: object[]): Response {
  const body = [
    ...chunks.map((chunk) => `data: ${JSON.stringify(chunk)}`),
    "data: [DONE]",
  ].join("\n\n");
  return new Response(`${body}\n\n`, {
    headers: { "content-type": "text/event-stream" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("ChatPanel", () => {
  it("renders the assistant header and closes from its button", async () => {
    const wrapper = mount(ChatPanel, {
      props: {
        companyId: "COMP_A",
        compareIds: ["COMP_A"],
        alerts,
        role: "ventas",
      },
    });
    expect(wrapper.find("h2").text()).toBe("TellMe · X Ray");
    await wrapper
      .find('button[aria-label="Cerrar el asistente"]')
      .trigger("click");
    expect(wrapper.emitted("close")).toEqual([[]]);
  });

  it("marks the alert count as truncated when the list reaches the fetch limit", () => {
    const capped = Array.from({ length: ALERTS_LIMIT }, (_, index) =>
      alert(`COMP_${index}`),
    );
    const wrapper = mount(ChatPanel, {
      props: {
        companyId: "COMP_A",
        compareIds: ["COMP_A"],
        alerts: capped,
        role: "ventas",
      },
    });
    expect(wrapper.text()).toContain(`${ALERTS_LIMIT}+ alertas`);
  });

  it("introduces itself as TellMe and hands a drafted operation to the page", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        sse([
          { type: "start" },
          {
            type: "tool-input-available",
            toolCallId: "d1",
            toolName: "draft_commitment",
            input: { company_id: "COMP_A" },
          },
          {
            type: "tool-output-available",
            toolCallId: "d1",
            output: {
              company_id: "COMP_A",
              draft: {
                opportunity: { title: "Pedido", revenue_minor: 5_000_000 },
              },
              missing: ["opportunity.costs"],
            },
          },
          { type: "finish" },
        ]),
      ),
    );
    const wrapper = mount(ChatPanel, {
      props: {
        companyId: "COMP_A",
        compareIds: ["COMP_A"],
        alerts,
        role: "tesorero",
      },
    });
    expect(wrapper.find(".panel-title").text()).toBe("TellMe · X Ray");
    await wrapper
      .find("input")
      .setValue("¿Puedo aceptar un pedido de 50.000 €?");
    await wrapper.find("form").trigger("submit");
    await vi.waitFor(() => expect(wrapper.emitted("draft")).toHaveLength(1));
    expect(wrapper.emitted("draft")?.[0]?.[0]).toMatchObject({
      company_id: "COMP_A",
      missing: ["opportunity.costs"],
    });
  });

  it("sends the confirmation hand-off with the confirmed operation", async () => {
    const bodies: string[] = [];
    vi.stubGlobal("fetch", (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(String(init?.body));
      return Promise.resolve(sse([{ type: "start" }, { type: "finish" }]));
    });
    const confirmedCommitment = {
      horizon_months: 1,
      reserve_floor_minor: 0,
      opportunity: {
        title: "Pedido",
        revenue_minor: 5_000_000,
        advance_date: "2026-09-02",
        final_payment_date: "2026-09-25",
        permitted_advance_bps: [0, 3000],
        costs: [{ id: "c", date: "2026-09-10", amount_minor: 1_000_000 }],
      },
    };
    const wrapper = mount(ChatPanel, {
      props: {
        companyId: "COMP_A",
        compareIds: ["COMP_A"],
        alerts,
        role: "tesorero",
        confirmedCommitment,
      },
    });
    wrapper.vm.sendConfirmation();
    await vi.waitFor(() => expect(bodies).toHaveLength(1));
    const body = JSON.parse(bodies[0] ?? "{}");
    expect(body.confirmed_commitment).toEqual(confirmedCommitment);
    expect(body.messages[0].parts[0].text).toBe(COMMITMENT_CONFIRMATION);
  });

  it("sends the companies the chart compares and omits them when only one is drawn", async () => {
    const bodies: string[] = [];
    vi.stubGlobal("fetch", (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(String(init?.body));
      return Promise.resolve(sse([{ type: "start" }, { type: "finish" }]));
    });
    const wrapper = mount(ChatPanel, {
      props: {
        companyId: "COMP_A",
        alerts,
        role: "financiero",
        compareIds: ["COMP_A", "COMP_B"],
      },
    });
    await wrapper.find("input").setValue("Compara ambas");
    await wrapper.find("form").trigger("submit");
    await vi.waitFor(() => expect(bodies).toHaveLength(1));
    expect(JSON.parse(bodies[0] ?? "{}").compare_ids).toEqual([
      "COMP_A",
      "COMP_B",
    ]);
    await wrapper.setProps({ compareIds: ["COMP_A"] });
    await wrapper.find("input").setValue("¿Y ahora?");
    await wrapper.find("form").trigger("submit");
    await vi.waitFor(() => expect(bodies).toHaveLength(2));
    expect("compare_ids" in JSON.parse(bodies[1] ?? "{}")).toBe(false);
  });

  it("sends the question with the company on screen and renders the streamed answer and tool calls", async () => {
    const requests: { url: string; body: string }[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), body: String(init?.body) });
      return Promise.resolve(
        sse([
          { type: "start" },
          {
            type: "tool-input-available",
            toolCallId: "c1",
            toolName: "score",
            input: { company_id: "COMP_B" },
          },
          {
            type: "tool-output-available",
            toolCallId: "c1",
            output: { score: 91 },
          },
          { type: "text-start", id: "t" },
          {
            type: "text-delta",
            id: "t",
            delta: "COMP_B está sana con 91 puntos.",
          },
          { type: "text-end", id: "t" },
          { type: "finish" },
        ]),
      );
    });
    const wrapper = mount(ChatPanel, {
      props: {
        companyId: "COMP_A",
        compareIds: ["COMP_A"],
        alerts,
        role: "ventas",
      },
    });
    expect(wrapper.text()).toContain(
      "2 alertas, 1 empresas empeoran y 1 se recuperan",
    );
    await wrapper.find("input").setValue("¿Cómo está COMP_B?");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain("COMP_B está sana con 91 puntos."),
    );
    expect(requests[0]?.url).toBe("/api/chat");
    const body = JSON.parse(requests[0]?.body ?? "{}");
    expect(body.company_id).toBe("COMP_A");
    expect(body.role).toBe("ventas");
    expect(body.messages[0].parts[0].text).toBe("¿Cómo está COMP_B?");
    expect(wrapper.find(".tool").text()).toBe("score COMP_B");
  });

  it("renders and emits the finished report as a PDF file", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        sse([
          { type: "start" },
          {
            type: "tool-input-available",
            toolCallId: "report-1",
            toolName: "report",
            input: { company: "COMP_A", role: "ventas" },
          },
          {
            type: "tool-output-available",
            toolCallId: "report-1",
            output: {
              company_id: "COMP_A",
              role: "ventas",
              export_url: "/api/companies/COMP_A/report.pdf?role=ventas",
            },
          },
          { type: "finish" },
        ]),
      ),
    );
    const wrapper = mount(ChatPanel, {
      props: {
        companyId: "COMP_A",
        compareIds: ["COMP_A"],
        alerts,
        role: "ventas",
      },
    });
    await wrapper.find("input").setValue("Exporta el informe");
    await wrapper.find("form").trigger("submit");
    await vi.waitFor(() => expect(wrapper.find(".file").exists()).toBe(true));
    const file = wrapper.find(".file");
    expect(file.text()).toBe("Informe listo: descargar PDF");
    expect(file.attributes("href")).toBe(
      "/api/companies/COMP_A/report.pdf?role=ventas",
    );
    expect(file.attributes("target")).toBe("_blank");
    expect(wrapper.emitted("report")).toEqual([
      [
        {
          company_id: "COMP_A",
          role: "ventas",
          export_url: "/api/companies/COMP_A/report.pdf?role=ventas",
        },
      ],
    ]);
  });

  it("labels each tool chip with the entity it queries, or the bare name without one", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        sse([
          { type: "start" },
          {
            type: "tool-input-available",
            toolCallId: "c1",
            toolName: "score",
            input: { company_id: "COMP_B" },
          },
          {
            type: "tool-input-available",
            toolCallId: "c2",
            toolName: "group_map",
            input: { group_id: "GROUP_1" },
          },
          {
            type: "tool-input-available",
            toolCallId: "c3",
            toolName: "alerts",
            input: { kind: "down", limit: 20 },
          },
          { type: "finish" },
        ]),
      ),
    );
    const wrapper = mount(ChatPanel, {
      props: {
        companyId: "COMP_A",
        compareIds: ["COMP_A"],
        alerts,
        role: "ventas",
      },
    });
    await wrapper.find("input").setValue("¿Cómo está el grupo?");
    await wrapper.find("form").trigger("submit");
    await vi.waitFor(() => expect(wrapper.findAll(".tool")).toHaveLength(3));
    expect(wrapper.findAll(".tool").map((chip) => chip.text())).toEqual([
      "score COMP_B",
      "group_map GROUP_1",
      "alerts",
    ]);
  });

  it("scrolls the message list down as the answer streams", async () => {
    const encoder = new TextEncoder();
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(stream) {
        controller = stream;
      },
    });
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        new Response(body, {
          headers: { "content-type": "text/event-stream" },
        }),
      ),
    );
    const wrapper = mount(ChatPanel, {
      props: {
        companyId: "COMP_A",
        compareIds: ["COMP_A"],
        alerts,
        role: "ventas",
      },
    });
    const list = wrapper.find(".messages").element;
    let height = 0;
    Object.defineProperty(list, "scrollHeight", { get: () => height });
    await wrapper.find("input").setValue("hola");
    await wrapper.find("form").trigger("submit");
    controller.enqueue(
      encoder.encode('data: {"type":"text-start","id":"t"}\n\n'),
    );
    await flushPromises();
    height = 100;
    controller.enqueue(
      encoder.encode('data: {"type":"text-delta","id":"t","delta":"uno"}\n\n'),
    );
    await flushPromises();
    await vi.waitFor(() => expect(list.scrollTop).toBe(100));
    height = 400;
    controller.enqueue(
      encoder.encode('data: {"type":"text-delta","id":"t","delta":" dos"}\n\n'),
    );
    await flushPromises();
    await vi.waitFor(() => expect(list.scrollTop).toBe(400));
    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
    controller.close();
  });
});
