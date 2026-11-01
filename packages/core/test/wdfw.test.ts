import { describe, expect, it } from "vitest";
import { extractHarvestProfile, htmlToText, localMinutes, parseHarvestProfile, parseRazorDigs, razorBeachFor } from "../src/index.ts";

describe("razor clam announcements", () => {
  it("parses the newspaper/news-release format", () => {
    const text = `Jan. 1, Saturday, 5:32 p.m.; -1.5 feet; Long Beach, Twin Harbors, Mocrocks`;
    const digs = parseRazorDigs(text, new Date("2021-12-09T00:00:00Z"));
    expect(digs).toHaveLength(1);
    expect(digs[0].date).toBe("2022-01-01");
    expect(digs[0].beaches).toEqual(["Long Beach", "Twin Harbors", "Mocrocks"]);
    expect(digs[0].lowTideFt).toBe(-1.5);
    expect(localMinutes(digs[0].lowTime!)).toBe(17 * 60 + 32);
  });

  it("parses the WDFW razor clam page format", () => {
    const text = [
      "Upcoming digs",
      "Monday, Oct. 26: Mocrocks only, low tide 7:18 p.m., -1.2 ft",
      "Tuesday, Oct. 27: Copalis only, low tide 8:01 p.m., -1.5 ft",
      "Long Beach and Twin Harbors remain closed until further notice.",
    ].join("\n");
    const digs = parseRazorDigs(text, new Date("2026-10-20T00:00:00Z"));
    expect(digs.map((d) => [d.date, d.beaches, d.lowTideFt])).toEqual([
      ["2026-10-26", ["Mocrocks"], -1.2],
      ["2026-10-27", ["Copalis"], -1.5],
    ]);
  });

  it("maps beach names to razor clam areas", () => {
    expect(razorBeachFor("Twin Harbors Beach SP")).toBe("Twin Harbors");
    expect(razorBeachFor("Potlatch SP")).toBeNull();
  });
});

describe("harvest profile", () => {
  it("reads absence from WDFW wording", () => {
    const text = "Not much is known about shellfish resources on this beach. Oysters are not expected to be common at this location.";
    expect(parseHarvestProfile(text)).toEqual({ oyster: "absent" });
  });

  it("reads abundance and scarcity per sentence", () => {
    const text =
      "Manila clams and native littlenecks are abundant in the gravel. Butter clams are found lower on the beach. Few cockles.";
    expect(parseHarvestProfile(text)).toEqual({
      manila_clam: "abundant",
      native_littleneck: "abundant",
      butter_clam: "present",
      cockle: "scarce",
    });
  });

  it("extracts the section from page text", () => {
    const page = htmlToText(
      "<h2>Harvest profile</h2><p>Oysters are plentiful.</p><h2>Directions</h2><p>Park at the lot.</p>",
    );
    expect(extractHarvestProfile(page)).toBe("Oysters are plentiful.");
  });
});
