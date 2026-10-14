/** A call to the game server that carries who is asking. */
type Request = (url: string, init?: RequestInit) => Promise<Response>;

/** Whether the company lets people choose their name, or null when the server would not say. */
export async function fetchAllowNameEdit(
  request: Request,
  adminBase: string,
): Promise<boolean | null> {
  try {
    const response = await request(`${adminBase}/settings`);
    if (!response.ok) return null;
    const body = (await response.json()) as { allowNameEdit?: unknown } | null;
    return typeof body?.allowNameEdit === "boolean" ? body.allowNameEdit : null;
  } catch {
    return null;
  }
}

/** Lets people choose their name, or stops them. Whether the server did it. */
export async function saveAllowNameEdit(
  request: Request,
  adminBase: string,
  allow: boolean,
): Promise<boolean> {
  try {
    const response = await request(`${adminBase}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowNameEdit: allow }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
