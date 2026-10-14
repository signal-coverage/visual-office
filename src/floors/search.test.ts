import { describe, expect, it } from "vitest";
import { floorFromSearch } from "./search";

describe("floorFromSearch", () => {
  it("is the floor asked for in the link (?floor=hr)", () => {
    expect(floorFromSearch("?floor=hr")).toBe("hr");
    expect(floorFromSearch("?name=Ana&floor=lab-2")).toBe("lab-2");
  });

  it("is nothing when the link says none, or says something that is not a floor", () => {
    for (const search of [
      "",
      "?name=Ana",
      "?floor=",
      "?floor=HR",
      "?floor=a b",
      "?floor=../x",
      "?floor=admin",
    ])
      expect(floorFromSearch(search), search).toBeNull();
  });
});
