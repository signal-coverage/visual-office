import { zoneLabel } from "./zones.ts";

/** One player as the list needs to know them. */
export interface RosterEntry {
  id: string;
  name: string;
  /** The private zone they are in, or null for the open office. */
  zone: string | null;
  /** Their chat colour (an index, see chatColor.ts). */
  color: number;
}

export interface RosterRow {
  id: string;
  name: string;
  color: number;
  you: boolean;
  /** Where they are, when that is a private zone and the list is not already about it. */
  place: string | null;
}

export interface Roster {
  title: string;
  count: number;
  entries: RosterRow[];
}

const OFFICE_TITLE = "In the office";

/**
 * Who is around, from the point of view of `selfId`. In the open office it is
 * everybody in the session, with a note on who is in a private zone. Inside a
 * private zone it is only the people in that zone, so the list never reveals
 * who else is online while you are in a meeting.
 */
export function buildRoster(players: RosterEntry[], selfId: string): Roster {
  const myZone = players.find((p) => p.id === selfId)?.zone ?? null;
  const visible = myZone ? players.filter((p) => p.zone === myZone) : players;

  const entries = visible
    .map((p): RosterRow => ({
      id: p.id,
      name: p.name,
      color: p.color,
      you: p.id === selfId,
      place: !myZone && p.zone ? zoneLabel(p.zone) : null,
    }))
    .sort((a, b) => {
      if (a.you !== b.you) return a.you ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

  return {
    title: myZone ? zoneLabel(myZone) : OFFICE_TITLE,
    count: entries.length,
    entries,
  };
}
