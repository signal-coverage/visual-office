import { useEffect, useState } from "react";
import { httpUrlOf } from "../editor/backend";
import { currentServerUrl } from "../game/serverAddress";
import { fetchRooms, withToken } from "./calendar";
import { POLL_MS } from "./consts";
import { describeRoomNow, viewerDay } from "./format";

/**
 * The line to show about the private room the player stands in (`label` is its name on screen): what
 * is on and what comes next, kept fresh while they stay in it. Null outside a
 * room, before the first answer, or when there is nothing to say.
 */
export function useRoomNow(
  label: string | null,
  getToken: () => Promise<string | null>,
): string | null {
  const [found, setFound] = useState<{
    label: string;
    text: string | null;
  } | null>(null);

  useEffect(() => {
    if (!label) return;
    let current = true;
    const request = withToken(getToken);
    const load = () =>
      void fetchRooms(
        request,
        httpUrlOf(currentServerUrl()),
        viewerDay(Date.now()),
      ).then((rooms) => {
        const room = rooms?.find((candidate) => candidate.label === label);
        if (current && room)
          setFound({ label, text: describeRoomNow(room, Date.now()) });
      });
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [label, getToken]);

  return label && found?.label === label ? found.text : null;
}
