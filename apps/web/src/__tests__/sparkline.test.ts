import type { CompanyDetail } from "@hackspain/shared";
import { type DOMWrapper, mount, type VueWrapper } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import Sparkline from "../components/Sparkline.vue";
import { company, month } from "./fixtures.ts";

function withMonths(id: string, months: string[]) {
  return {
    ...company(id, "GROUP_1"),
    series: months.map((name) => month(name, 50, "stable")),
  };
}

function withScores(id: string, scores: number[], momentum: number | null) {
  const series = scores.map((score, index) =>
    month(`2026-${String(index + 1).padStart(2, "0")}`, score, "stable"),
  );
  const last = series.at(-1);
  if (last) {
    last.momentum = momentum;
  }
  const detail = { ...company(id, "GROUP_1"), series };
  if (!(last && momentum !== null)) {
    return detail;
  }
  const changes = scores
    .slice(1)
    .map((value, index) => value - (scores[index] ?? value));
  const average =
    changes.reduce((total, value) => total + value, 0) / changes.length;
  const volatility =
    changes.length < 3
      ? 0
      : Math.sqrt(
          changes.reduce((total, value) => total + (value - average) ** 2, 0) /
            (changes.length - 1),
        );
  return withProjection(
    detail,
    [1, 2, 3].map((horizon) => {
      const base = Math.max(
        0,
        Math.min(100, (last.score ?? 0) + (momentum * horizon) / 3),
      );
      const spread = volatility * Math.sqrt(horizon);
      return {
        base,
        favorable: Math.max(0, Math.min(100, base + spread)),
        adverse: Math.max(0, Math.min(100, base - spread)),
      };
    }),
  );
}

function futureMonth(month: string, offset: number) {
  const [year, number] = month.split("-").map(Number);
  const index = (year ?? 0) * 12 + (number ?? 1) - 1 + offset;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

function withProjection(
  detail: CompanyDetail,
  points: { base: number; favorable: number; adverse: number }[],
): CompanyDetail {
  const latest = [...detail.series]
    .sort((a, b) => a.month.localeCompare(b.month))
    .findLast((entry) => entry.score !== null);
  if (!latest) {
    return detail;
  }
  return {
    ...detail,
    trend_projection: {
      rule_version: "xray-trend-projection/test",
      status: "available",
      reason: null,
      semantics: "scenario_range_not_confidence_interval",
      observed_months: detail.months_observed,
      min_months_required: 1,
      months_missing: 0,
      points: points.map((point, index) => ({
        month: futureMonth(latest.month, index + 1),
        ...point,
      })),
      evidence: {
        latest_score: latest.score ?? 0,
        momentum: latest.momentum ?? 0,
        volatility: 0,
        source_months: detail.series
          .filter((entry) => entry.score !== null)
          .map((entry) => entry.month),
      },
    },
  };
}

function twoYears() {
  return [
    "2024-12",
    ...[2025, 2026].flatMap((year) =>
      Array.from(
        { length: 12 },
        (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`,
      ),
    ),
  ];
}

function pointX(circles: DOMWrapper<Element>[], id: string, name: string) {
  const circle = circles.find((candidate) =>
    candidate.find("title").text().includes(`${id} · ${name}`),
  );
  return Number(circle?.attributes("cx"));
}

function coordinates(wrapper: Pick<DOMWrapper<Element>, "attributes">) {
  return (wrapper.attributes("points") ?? "")
    .split(" ")
    .map((point) => point.split(",").map(Number));
}

function score(y: number) {
  return 100 * (1 - (y - 24) / 264);
}

function segments(path: Pick<DOMWrapper<Element>, "attributes">) {
  return (path.attributes("d") ?? "").split("C").length - 1;
}

function hover(wrapper: VueWrapper, index: number) {
  return wrapper.findAll("rect.hit")[index]?.trigger("pointerenter");
}

describe("Sparkline", () => {
  it("marks the latest observed month of the union and shades the next three months", () => {
    const wrapper = mount(Sparkline, {
      props: {
        companies: [
          withMonths("COMP_A", ["2026-10", "2026-11"]),
          withMonths("COMP_B", ["2026-10", "2026-11", "2026-12"]),
        ],
      },
    });
    const marker = wrapper.get("line.today-marker");
    const lastX = pointX(wrapper.findAll("circle"), "COMP_B", "2026-12");
    expect(Number(marker.attributes("x1"))).toBeCloseTo(400.8);
    expect(Number(marker.attributes("x1"))).toBe(lastX);
    expect(Number(marker.attributes("x2"))).toBe(lastX);
    expect(marker.attributes("stroke-dasharray")).toBe("1 3");
    const label = wrapper.get("text.today-label");
    expect(label.text()).toBe("hoy");
    expect(Number(label.attributes("x"))).toBe(lastX);
    expect(Number(label.attributes("y"))).toBeLessThan(
      Number(marker.attributes("y1")),
    );
    const shade = wrapper.get("rect.projection-area");
    expect(Number(shade.attributes("x"))).toBe(lastX);
    expect(Number(shade.attributes("width"))).toBeCloseTo(535.2);
    expect(wrapper.findAll("text.month").map((item) => item.text())).toEqual([
      "dic 26",
      "mar 27",
    ]);
    expect(wrapper.findAll("circle")).toHaveLength(2);
  });

  it("retains 24 observed months before adding the three future months", () => {
    const wrapper = mount(Sparkline, {
      props: { companies: [withMonths("COMP_A", twoYears())] },
    });
    expect(wrapper.findAll("text.month").map((item) => item.text())).toEqual([
      "mar 25",
      "jun 25",
      "sep 25",
      "dic 25",
      "mar 26",
      "jun 26",
      "sep 26",
      "dic 26",
      "mar 27",
    ]);
    expect(segments(wrapper.get("path.series-line"))).toBe(23);
    expect(wrapper.get("path.series-line").attributes("d")).toMatch(/^M44,/);
    expect(wrapper.findAll("circle")).toHaveLength(1);
    expect(wrapper.get("circle title").text()).toContain("2026-12");
  });

  it("draws a soft grid at every quarter of the score range", () => {
    const wrapper = mount(Sparkline, {
      props: { companies: [company("COMP_A", "GROUP_1")] },
    });
    expect(
      wrapper.findAll("line.grid").map((line) => Number(line.attributes("y1"))),
    ).toEqual([288, 222, 156, 90, 24]);
    expect(
      wrapper
        .findAll("text.axis")
        .slice(0, 5)
        .map((t) => t.text()),
    ).toEqual(["0", "25", "50", "75", "100"]);
  });

  it("fills a gradient area under each observed series down to the baseline", () => {
    const wrapper = mount(Sparkline, {
      props: {
        companies: [
          withScores("COMP_A", [30, 60, 45], null),
          withScores("COMP_B", [80, 70, 75], null),
        ],
      },
    });
    const areas = wrapper.findAll("path.series-area");
    expect(areas).toHaveLength(2);
    const lines = wrapper.findAll("path.series-line");
    areas.forEach((area, index) => {
      const line = lines[index]?.attributes("d") ?? "";
      expect(area.attributes("d")).toBe(`${line} L400.8,288 L44,288 Z`);
      const fill = area.attributes("fill") ?? "";
      const id = fill.slice("url(#".length, -1);
      const stops = wrapper.findAll(`linearGradient[id="${id}"] stop`);
      expect(stops.map((stop) => stop.attributes("stop-opacity"))).toEqual([
        "0.35",
        "0",
      ]);
      expect(stops[0]?.attributes("stop-color")).toBe(
        lines[index]?.attributes("stroke"),
      );
    });
  });

  it("joins observed points with monotone cubic segments that respect the data", () => {
    const wrapper = mount(Sparkline, {
      props: { companies: [withScores("COMP_A", [20, 60, 60, 90], null)] },
    });
    const line = wrapper.get("path.series-line");
    expect(segments(line)).toBe(3);
    const commands = (line.attributes("d") ?? "").split(" ");
    expect(commands[0]).toBe(`M44,${24 + 0.8 * 264}`);
    const plateau = commands.slice(4, 7).map((c) => c.replace("C", ""));
    const ys = plateau.map((c) => Number(c.split(",")[1]));
    expect(ys).toEqual([24 + 0.4 * 264, 24 + 0.4 * 264, 24 + 0.4 * 264]);
  });

  it("marks only the last observed point and the E1 months with a circle", () => {
    const wrapper = mount(Sparkline, {
      props: {
        companies: [
          {
            ...company("COMP_A", "GROUP_1"),
            series: [
              month("2026-09", 70, "healthy"),
              month("2026-10", 40, "falling"),
              month("2026-11", 50, "stable"),
              month("2026-12", 60, "stable"),
            ],
          },
        ],
      },
    });
    const titles = wrapper.findAll("circle title").map((title) => title.text());
    expect(titles).toEqual([
      expect.stringContaining("2026-10"),
      expect.stringContaining("2026-12"),
    ]);
    expect(wrapper.findAll("circle")[0]?.attributes("fill")).toBe(
      "var(--falling)",
    );
  });

  it.each([
    { score: 85, momentum: 30, values: [85, 95, 100, 100] },
    { score: 15, momentum: -30, values: [15, 5, 0, 0] },
    { score: 40, momentum: 15, values: [40, 45, 50, 55] },
    { score: 50, momentum: 0, values: [50, 50, 50, 50] },
  ])(
    "renders the three server trend points from score $score and momentum $momentum",
    ({ score: last, momentum, values }) => {
      const wrapper = mount(Sparkline, {
        props: {
          companies: [withScores("COMP_A", [50, last], momentum)],
        },
      });
      const projection = wrapper.get("polyline.projection-line");
      const points = coordinates(projection);
      expect(points).toHaveLength(4);
      expect(points.map(([x]) => x)).toEqual([267, 490, 713, 936]);
      points.forEach(([, y], index) => {
        expect(score(Number(y))).toBeCloseTo(values[index] ?? 0);
      });
      expect(projection.attributes("stroke-dasharray")).toBe("6 5");
      expect(Number(projection.attributes("opacity"))).toBeGreaterThan(0);
      expect(Number(projection.attributes("opacity"))).toBeLessThan(1);
      expect(projection.attributes("stroke")).toBe(
        wrapper.get(".series-line").attributes("stroke"),
      );
      expect(wrapper.findAll("circle")).toHaveLength(1);
    },
  );

  it("renders the server scenario instead of recalculating it from momentum", () => {
    const detail = company("COMP_A", "GROUP_1");
    const series = [
      month("2026-11", 30, "stable"),
      { ...month("2026-12", 40, "stable"), momentum: 99 },
    ];
    const wrapper = mount(Sparkline, {
      props: {
        companies: [
          withProjection({ ...detail, series }, [
            { base: 12, favorable: 20, adverse: 4 },
            { base: 34, favorable: 45, adverse: 23 },
            { base: 56, favorable: 70, adverse: 42 },
          ]),
        ],
      },
    });
    expect(
      coordinates(wrapper.get("polyline.projection-line")).map(([, y]) =>
        Math.round(score(Number(y))),
      ),
    ).toEqual([40, 12, 34, 56]);
  });

  it("projects only the series whose server contract is available", () => {
    const wrapper = mount(Sparkline, {
      props: {
        companies: [
          {
            ...company("COMP_A", "GROUP_1"),
            series: [
              { ...month("2026-10", 50, "stable"), momentum: 20 },
              month("2026-11", 60, "healthy"),
            ],
          },
          withProjection(
            {
              ...company("COMP_B", "GROUP_1"),
              series: [
                month("2026-12", null, "not_evaluable"),
                { ...month("2026-11", 60, "healthy"), momentum: -30 },
                month("2026-10", 50, "stable"),
              ],
            },
            [
              { base: 50, favorable: 50, adverse: 50 },
              { base: 40, favorable: 40, adverse: 40 },
              { base: 30, favorable: 30, adverse: 30 },
            ],
          ),
          {
            ...company("COMP_C", "GROUP_1"),
            series: [month("2026-12", null, "not_evaluable")],
          },
        ],
      },
    });
    const projections = wrapper.findAll("polyline.projection-line");
    expect(projections).toHaveLength(1);
    const projection = wrapper.get("polyline.projection-line");
    expect(projection.attributes("stroke")).toBe(
      wrapper.findAll(".series-line")[1]?.attributes("stroke"),
    );
    const points = coordinates(projection);
    expect(points[0]?.[0]).toBe(
      pointX(wrapper.findAll("circle"), "COMP_B", "2026-11"),
    );
    expect(points[1]?.[0]).toBeCloseTo(400.8);
    expect(points[3]?.[0]).toBeCloseTo(757.6);
    expect(points[3]?.[1]).toBeCloseTo(208.8);
    expect(wrapper.findAll("circle")).toHaveLength(2);
  });

  it("shades a trend band around the projection that widens with the square root of the horizon", () => {
    const wrapper = mount(Sparkline, {
      props: {
        companies: [
          withScores("COMP_A", [10, 20, 40, 70], 0),
          withScores("COMP_B", [10, 20, 40, 70], null),
        ],
      },
    });
    const bands = wrapper.findAll("polygon.projection-band");
    expect(bands).toHaveLength(1);
    const band = bands[0];
    expect(band?.attributes("fill")).toBe(
      wrapper.get(".series-line").attributes("stroke"),
    );
    expect(band?.attributes("fill-opacity")).toBe("0.12");
    const points = band ? coordinates(band) : [];
    expect(points).toHaveLength(7);
    expect(points[0]).toEqual([
      Number(wrapper.get("circle").attributes("cx")),
      Number(wrapper.get("circle").attributes("cy")),
    ]);
    const upper = points.slice(1, 4);
    const lower = points.slice(4).reverse();
    [1, 2, 3].forEach((step) => {
      const top = upper[step - 1] ?? [];
      const bottom = lower[step - 1] ?? [];
      expect(top[0]).toBe(bottom[0]);
      expect(top[0]).toBeCloseTo(44 + ((3 + step) / 6) * 892);
      expect(score(Number(top[1])) - score(Number(bottom[1]))).toBeCloseTo(
        20 * Math.sqrt(step),
      );
      expect(score(Number(top[1])) + score(Number(bottom[1]))).toBeCloseTo(140);
    });
  });

  it("collapses the band to the projection when fewer than three changes are observed", () => {
    const wrapper = mount(Sparkline, {
      props: { companies: [withScores("COMP_A", [40, 60, 50], 12)] },
    });
    const points = coordinates(wrapper.get("polygon.projection-band"));
    const projection = coordinates(wrapper.get("polyline.projection-line"));
    expect(points.slice(1, 4)).toEqual(projection.slice(1));
    expect(points.slice(4).reverse()).toEqual(projection.slice(1));
  });

  it("clips the band to the score range", () => {
    const wrapper = mount(Sparkline, {
      props: { companies: [withScores("COMP_A", [35, 45, 65, 95], 0)] },
    });
    const points = coordinates(wrapper.get("polygon.projection-band"));
    expect(points.slice(1, 4).map(([, y]) => score(Number(y)))).toEqual([
      100, 100, 100,
    ]);
    expect(score(Number(points[6]?.[1]))).toBeCloseTo(85);
  });

  it("cuts the observed window to six months when 6M is pressed while the projection stays", async () => {
    const detail = company("COMP_A", "GROUP_1");
    const series = twoYears().map((name, index) => ({
      ...month(name, 40 + (index % 5), "stable"),
      momentum: index === 24 ? 9 : null,
    }));
    const wrapper = mount(Sparkline, {
      props: {
        companies: [
          withProjection({ ...detail, series }, [
            { base: 47, favorable: 47, adverse: 47 },
            { base: 50, favorable: 50, adverse: 50 },
            { base: 53, favorable: 53, adverse: 53 },
          ]),
        ],
      },
    });
    const buttons = wrapper.findAll(".range button");
    expect(buttons.map((button) => button.text())).toEqual([
      "6M",
      "12M",
      "24M",
    ]);
    expect(buttons.map((button) => button.attributes("aria-pressed"))).toEqual([
      "false",
      "false",
      "true",
    ]);
    expect(segments(wrapper.get("path.series-line"))).toBe(23);
    await buttons[0]?.trigger("click");
    expect(buttons.map((button) => button.attributes("aria-pressed"))).toEqual([
      "true",
      "false",
      "false",
    ]);
    expect(segments(wrapper.get("path.series-line"))).toBe(5);
    expect(wrapper.get("path.series-line").attributes("d")).toMatch(/^M44,/);
    expect(Number(wrapper.get("line.today-marker").attributes("x1"))).toBe(
      601.5,
    );
    expect(wrapper.findAll("text.month").map((item) => item.text())).toEqual([
      "sep 26",
      "dic 26",
      "mar 27",
    ]);
    expect(coordinates(wrapper.get("polyline.projection-line"))).toHaveLength(
      4,
    );
    expect(wrapper.get("svg").attributes("aria-label")).toBe(
      "Evolución del score en 6 meses y proyección por tendencia a 3 meses",
    );
  });

  it("shows the hovered month with each score, the projected value on future months, and hides on leave", async () => {
    const detail = company("COMP_A", "GROUP_1");
    const series = [
      month("2026-11", 30, "stable"),
      { ...month("2026-12", 40, "stable"), momentum: 15 },
    ];
    const wrapper = mount(Sparkline, {
      props: {
        companies: [
          withProjection({ ...detail, series }, [
            { base: 45, favorable: 45, adverse: 45 },
            { base: 50, favorable: 50, adverse: 50 },
            { base: 55, favorable: 55, adverse: 55 },
          ]),
          withMonths("COMP_B", ["2026-12"]),
        ],
      },
    });
    expect(wrapper.find(".tooltip").exists()).toBe(false);
    expect(wrapper.findAll("rect.hit")).toHaveLength(5);
    await hover(wrapper, 0);
    let tooltip = wrapper.get(".tooltip");
    expect(tooltip.get("strong").text()).toBe("noviembre de 2026");
    expect(tooltip.findAll("span").map((row) => row.text())).toEqual([
      "COMP_A 30",
      "COMP_B –",
    ]);
    expect(Number(wrapper.get("line.hover-line").attributes("x1"))).toBe(44);
    await hover(wrapper, 2);
    tooltip = wrapper.get(".tooltip");
    expect(tooltip.get("strong").text()).toBe("enero de 2027");
    expect(tooltip.findAll("span").map((row) => row.text())).toEqual([
      "COMP_A proyección 45",
    ]);
    expect(Number(wrapper.get("line.hover-line").attributes("x1"))).toBe(490);
    await wrapper.get("svg").trigger("pointerleave");
    expect(wrapper.find(".tooltip").exists()).toBe(false);
    expect(wrapper.find("line.hover-line").exists()).toBe(false);
  });

  it("names the trend projection and band in the legend and accessible chart label", () => {
    const wrapper = mount(Sparkline, {
      props: { companies: [company("COMP_A", "GROUP_1")] },
    });
    expect(wrapper.get("svg").attributes("aria-label")).toBe(
      "Evolución del score en 24 meses y proyección por tendencia a 3 meses",
    );
    expect(wrapper.get(".chart-head h2").text()).toBe("Evolución del score");
    expect(wrapper.get(".legend").text()).toContain(
      "proyección por tendencia (3 meses)",
    );
    expect(wrapper.get(".legend").text()).toContain("rango por tendencia");
    expect(wrapper.find(".legend .projection-sample").exists()).toBe(true);
    expect(wrapper.find(".legend .band-sample").exists()).toBe(true);
  });

  it("draws a month that only the second company holds", () => {
    const wrapper = mount(Sparkline, {
      props: {
        companies: [
          withMonths("COMP_A", ["2026-06", "2026-07"]),
          withMonths("COMP_B", ["2026-06", "2026-07", "2026-08"]),
        ],
      },
    });
    const titles = wrapper.findAll("circle title").map((title) => title.text());
    expect(titles.filter((text) => text.includes("2026-08"))).toEqual([
      expect.stringContaining("COMP_B · 2026-08"),
    ]);
    const lines = wrapper.findAll("path.series-line");
    expect(lines[0]?.attributes("d")).toMatch(/ L222.4,\d+(\.\d+)?$/);
    expect(lines[1]?.attributes("d")).toMatch(/ 400.8,\d+(\.\d+)?$/);
  });

  it("orders the axis by month whatever order the companies report", () => {
    const wrapper = mount(Sparkline, {
      props: {
        companies: [
          withMonths("COMP_A", ["2026-07", "2026-08"]),
          withMonths("COMP_B", ["2026-05", "2026-06"]),
        ],
      },
    });
    expect(wrapper.findAll("text.month").map((label) => label.text())).toEqual([
      "may 26",
      "ago 26",
      "nov 26",
    ]);
    const circles = wrapper.findAll("circle");
    expect(pointX(circles, "COMP_B", "2026-06")).toBeLessThan(
      pointX(circles, "COMP_A", "2026-08"),
    );
  });

  it("places colored company controls before the range buttons", async () => {
    const wrapper = mount(Sparkline, {
      props: {
        companies: [
          {
            ...company("COMP_0176", "GROUP_1"),
            name: "Talleres Ribera",
          },
          company("COMP_A", "GROUP_1"),
        ],
      },
    });
    expect(
      wrapper
        .findAll(".chart-company")
        .map((item) => item.text().replace("×", "").trim()),
    ).toEqual(["Talleres Ribera", "COMP_A"]);
    expect(
      wrapper
        .findAll(".chart-company i")
        .map((item) => item.attributes("style")),
    ).toEqual(["background: var(--series-1);", "background: var(--series-2);"]);
    expect(wrapper.get(".chart-controls").element.children[0]?.className).toBe(
      "chart-companies",
    );
    expect(wrapper.get(".chart-controls").element.children[1]?.className).toBe(
      "range",
    );
    expect(wrapper.findAll(".legend span").map((item) => item.text())).toEqual([
      "proyección por tendencia (3 meses)",
      "rango por tendencia",
    ]);
    await wrapper.get('button[aria-label="Quitar COMP_A"]').trigger("click");
    expect(wrapper.emitted("remove")).toEqual([["COMP_A"]]);
  });
});
