import { describe, expect, it } from "vitest";
import { fetchAllowNameEdit, saveAllowNameEdit } from "./companySettings";

const base = "https://office.example.com/admin";

function api(answer: { status?: number; body?: unknown } | Error) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const request = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify(answer.body ?? {}), {
      status: answer.status ?? 200,
    });
  };
  return { calls, request };
}

describe("fetchAllowNameEdit", () => {
  it("brings what the company decided", async () => {
    const { request, calls } = api({ body: { allowNameEdit: true } });
    expect(await fetchAllowNameEdit(request, base)).toBe(true);
    expect(calls[0].url).toBe(`${base}/settings`);
    expect(
      await fetchAllowNameEdit(
        api({ body: { allowNameEdit: false } }).request,
        base,
      ),
    ).toBe(false);
  });

  it("is null when the server would not say, or said something odd", async () => {
    expect(
      await fetchAllowNameEdit(api({ status: 403, body: {} }).request, base),
    ).toBeNull();
    expect(
      await fetchAllowNameEdit(
        api({ body: { allowNameEdit: "yes" } }).request,
        base,
      ),
    ).toBeNull();
    expect(
      await fetchAllowNameEdit(api({ body: {} }).request, base),
    ).toBeNull();
    expect(
      await fetchAllowNameEdit(api(new Error("offline")).request, base),
    ).toBeNull();
  });
});

describe("saveAllowNameEdit", () => {
  it("tells the server and says it did it", async () => {
    const { request, calls } = api({ body: { allowNameEdit: true } });
    expect(await saveAllowNameEdit(request, base, true)).toBe(true);
    expect(calls[0].url).toBe(`${base}/settings`);
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      allowNameEdit: true,
    });
  });

  it("says it did not when the server refused or could not be reached", async () => {
    expect(
      await saveAllowNameEdit(api({ status: 403 }).request, base, true),
    ).toBe(false);
    expect(
      await saveAllowNameEdit(api(new Error("offline")).request, base, false),
    ).toBe(false);
  });
});
