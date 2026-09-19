import { type DOMWrapper, mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import Sparkline from "../components/Sparkline.vue";
import { company, month } from "./fixtures.ts";

function withMonths(id: string, months: string[]) {
  return {
    ...company(id, "GROUP_1"),
    series: months.map((name) => month(name, 50, "stable")),
  };
}

function pointX(circles: DOMWrapper<Element>[], id: string, name: string) {
  const circle = circles.find((candidate) =>
    candidate.find("title").text().includes(`${id} · ${name}`),
  );
  return Number(circle?.attributes("cx"));
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
    expect(Number(marker.attributes("x1"))).toBeCloseTo(213.6);
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
    expect(Number(shade.attributes("width"))).toBeCloseTo(278.4);
    expect(wrapper.findAll("text.month").map((item) => item.text())).toEqual([
      "2026-10",
      "2027-03",
    ]);
    expect(wrapper.findAll("circle")).toHaveLength(5);
  });

  it("retains 24 observed months before adding the three future months", () => {
    const names = [
      "2024-12",
      ...[2025, 2026].flatMap((year) =>
        Array.from(
          { length: 12 },
          (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`,
        ),
      ),
    ];
    const wrapper = mount(Sparkline, {
      props: { companies: [withMonths("COMP_A", names)] },
    });
    expect(wrapper.findAll("text.month").map((item) => item.text())).toEqual([
      "2025-01",
      "2025-07",
      "2026-01",
      "2026-07",
      "2027-03",
    ]);
    expect(wrapper.findAll("circle")).toHaveLength(24);
    expect(wrapper.find("circle title").text()).toContain("2025-01");
  });

  it.each([
    { score: 85, momentum: 30, values: [85, 95, 100, 100] },
    { score: 15, momentum: -30, values: [15, 5, 0, 0] },
    { score: 40, momentum: 15, values: [40, 45, 50, 55] },
    { score: 50, momentum: 0, values: [50, 50, 50, 50] },
  ])(
    "projects three months from score $score with momentum $momentum",
    ({ score, momentum, values }) => {
      const wrapper = mount(Sparkline, {
        props: {
          companies: [
            {
              ...company("COMP_A", "GROUP_1"),
              series: [
                month("2026-11", 50, "stable"),
                { ...month("2026-12", score, "stable"), momentum },
              ],
            },
          ],
        },
      });
      const projection = wrapper.get("polyline.projection-line");
      const coordinates = (projection.attributes("points") ?? "")
        .split(" ")
        .map((point) => point.split(",").map(Number));
      expect(coordinates).toHaveLength(4);
      expect(coordinates.map(([x]) => x)).toEqual([144, 260, 376, 492]);
      coordinates.forEach(([, y], index) => {
        expect(100 * (1 - (Number(y) - 14) / 112)).toBeCloseTo(
          values[index] ?? 0,
        );
      });
      expect(projection.attributes("stroke-dasharray")).toBe("5 4");
      expect(Number(projection.attributes("opacity"))).toBeGreaterThan(0);
      expect(Number(projection.attributes("opacity"))).toBeLessThan(1);
      expect(projection.attributes("stroke")).toBe(
        wrapper.get(".series-line").attributes("stroke"),
      );
      expect(wrapper.findAll("circle")).toHaveLength(2);
    },
  );

  it("projects only the series whose last scored entry has momentum", () => {
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
          {
            ...company("COMP_B", "GROUP_1"),
            series: [
              month("2026-12", null, "not_evaluable"),
              { ...month("2026-11", 60, "healthy"), momentum: -30 },
              month("2026-10", 50, "stable"),
            ],
          },
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
    const coordinates = (projection.attributes("points") ?? "")
      .split(" ")
      .map((point) => point.split(",").map(Number));
    expect(coordinates[0]?.[0]).toBe(
      pointX(wrapper.findAll("circle"), "COMP_B", "2026-11"),
    );
    expect(coordinates[1]?.[0]).toBeCloseTo(306.4);
    expect(coordinates[3]?.[0]).toBe(492);
    expect(coordinates[3]?.[1]).toBeCloseTo(92.4);
    expect(wrapper.findAll("circle")).toHaveLength(4);
  });

  it("names the trend projection in the legend and accessible chart label", () => {
    const wrapper = mount(Sparkline, {
      props: { companies: [company("COMP_A", "GROUP_1")] },
    });
    expect(wrapper.get("svg").attributes("aria-label")).toBe(
      "Evolución del score en 24 meses y proyección por tendencia a 3 meses",
    );
    expect(wrapper.get(".legend").text()).toContain(
      "proyección por tendencia (3 meses)",
    );
    expect(wrapper.find(".legend .projection-sample").exists()).toBe(true);
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
    expect(wrapper.findAll("circle")).toHaveLength(5);
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
      "2026-05",
      "2026-11",
    ]);
    const circles = wrapper.findAll("circle");
    expect(pointX(circles, "COMP_B", "2026-06")).toBeLessThan(
      pointX(circles, "COMP_A", "2026-07"),
    );
  });

  it("labels the legend with the demo name when there is one, else the id", () => {
    const wrapper = mount(Sparkline, {
      props: {
        companies: [
          company("COMP_0176", "GROUP_1"),
          company("COMP_A", "GROUP_1"),
        ],
      },
    });
    expect(wrapper.findAll(".legend span").map((item) => item.text())).toEqual([
      "Talleres Ribera",
      "COMP_A",
      "proyección por tendencia (3 meses)",
    ]);
  });
});
