/** Somebody who signed in, with what they may do. */
export interface Person {
  id: string;
  name: string;
  email: string | null;
  isAdmin: boolean;
  /** The floors they are head of. */
  headOf: string[];
}

export interface PeopleList {
  /** The floors there are. */
  floors: string[];
  people: Person[];
}

/** A call to the game server that carries who is asking. */
type Request = (url: string, init?: RequestInit) => Promise<Response>;

const isPerson = (value: unknown): value is Person => {
  if (typeof value !== "object" || value === null) return false;
  const person = value as Record<string, unknown>;
  return (
    typeof person.id === "string" &&
    typeof person.name === "string" &&
    (typeof person.email === "string" || person.email === null) &&
    typeof person.isAdmin === "boolean" &&
    Array.isArray(person.headOf) &&
    person.headOf.every((floor) => typeof floor === "string")
  );
};

/** Everybody who signed in and the floors there are, or null when the server would not say. */
export async function fetchPeople(
  request: Request,
  adminBase: string,
): Promise<PeopleList | null> {
  try {
    const response = await request(`${adminBase}/people`);
    if (!response.ok) return null;
    const body = (await response.json()) as {
      floors?: unknown;
      people?: unknown;
    } | null;
    if (
      !Array.isArray(body?.floors) ||
      !body.floors.every((floor) => typeof floor === "string") ||
      !Array.isArray(body.people) ||
      !body.people.every(isPerson)
    )
      return null;
    return { floors: body.floors, people: body.people };
  } catch {
    return null;
  }
}

/** Names somebody head of a floor, or takes it away. Whether the server did it. */
export async function setHead(
  request: Request,
  adminBase: string,
  floor: string,
  userId: string,
  head: boolean,
): Promise<boolean> {
  try {
    const response = await request(`${adminBase}/floors/${floor}/heads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, head }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** The list with somebody made head of a floor, or no longer. The list it was given is not changed. */
export function withHead(
  people: readonly Person[],
  userId: string,
  floor: string,
  head: boolean,
): Person[] {
  return people.map((person) => {
    if (person.id !== userId) return person;
    const others = person.headOf.filter((f) => f !== floor);
    return { ...person, headOf: (head ? [...others, floor] : others).sort() };
  });
}
