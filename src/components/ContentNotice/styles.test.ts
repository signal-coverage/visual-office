import { describe, expect, it } from "vitest";
import { loading } from "./styles";

describe("the loading notice", () => {
  it("clips what turns inside it: the corners of a spinning spinner would stick out and make the scrollbar of the panel around it come and go", () => {
    expect(loading.split(" ")).toContain("overflow-clip");
  });
});
