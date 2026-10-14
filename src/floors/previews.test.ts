import { describe, expect, it } from "vitest";
import { fetchPreviews, parsePreviews } from "./previews";

const good = {
  id: "office",
  width: 30,
  depth: 20,
  walls: [[-15, -10, 15, -9.7]],
  glass: [],
  zones: [[-14, -9, -6, -2]],
  items: [[-3, -6, -1, -5]],
};

describe("parsePreviews", () => {
  it("keeps a well-formed plan", () => {
    expect(parsePreviews({ previews: [good] })).toEqual([good]);
  });

  it("is nothing when the answer is not a list of plans", () => {
    expect(parsePreviews(null)).toBeNull();
    expect(parsePreviews({})).toBeNull();
    expect(parsePreviews({ previews: "x" })).toBeNull();
  });

  it("leaves out a plan that is malformed and keeps the others", () => {
    const parsed = parsePreviews({
      previews: [{ id: 3 }, good, { ...good, id: "x", width: 0 }],
    });
    expect(parsed?.map((plan) => plan.id)).toEqual(["office"]);
  });

  it("leaves out rectangles that are not four numbers, and extra fields", () => {
    const parsed = parsePreviews({
      previews: [
        {
          ...good,
          secret: "x",
          items: [
            [1, 2, 3],
            [1, 2, 3, "4"],
            [0, 0, 1, 1],
          ],
        },
      ],
    });
    expect(parsed?.[0].items).toEqual([[0, 0, 1, 1]]);
    expect(parsed?.[0]).not.toHaveProperty("secret");
  });
});

describe("fetchPreviews", () => {
  const api = (response: Response | Error) => {
    const urls: string[] = [];
    return {
      urls,
      request: async (url: string) => {
        urls.push(url);
        if (response instanceof Error) throw response;
        return response.clone();
      },
    };
  };

  it("asks the server for the plans of the rooms", async () => {
    const { request, urls } = api(
      new Response(JSON.stringify({ previews: [good] })),
    );
    expect(await fetchPreviews(request, "https://o.example")).toEqual([good]);
    expect(urls).toEqual(["https://o.example/account/floors/previews"]);
  });

  it("is nothing when the server refuses or cannot be reached", async () => {
    expect(
      await fetchPreviews(
        api(new Response("{}", { status: 503 })).request,
        "x",
      ),
    ).toBeNull();
    expect(await fetchPreviews(api(new Error("down")).request, "x")).toBeNull();
  });
});
