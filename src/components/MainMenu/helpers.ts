import type { FloorInfo } from "../../../shared/floors.ts";
import { canTravel } from "../../floors/travel";
import {
  ADMIN_LABELS,
  LABELS,
  LOOKING_FOR_OFFICES,
  ONLY_ONE_OFFICE,
} from "./consts";
import type { AdminHandlers, AdminTool, MenuItem } from "./types";

/** The four options of the menu. Other offices need more than one office; while joining nothing can be pressed. */
export function menuItems(
  floors: readonly FloorInfo[] | null,
  busy: boolean,
): MenuItem[] {
  const hasRooms = canTravel(floors);
  return [
    { id: "enter", label: LABELS.enter, disabled: busy },
    {
      id: "rooms",
      label: LABELS.rooms,
      disabled: busy || !hasRooms,
      hint: hasRooms
        ? undefined
        : floors === null
          ? LOOKING_FOR_OFFICES
          : ONLY_ONE_OFFICE,
    },
    { id: "customize", label: LABELS.customize, disabled: busy },
    { id: "exit", label: LABELS.exit, disabled: busy },
  ];
}

const ADMIN_ORDER: ReadonlyArray<keyof AdminHandlers> = [
  "onEditFloor",
  "onManagePeople",
  "onInvitePeople",
  "onOpenSettings",
  "onOpenActivity",
  "onOpenCalendars",
  "onManageRooms",
  "onManageGroups",
  "onManageContent",
];

/** The administration tools this person may use. */
export function adminTools(handlers: AdminHandlers): AdminTool[] {
  return ADMIN_ORDER.flatMap((id) => {
    const onPress = handlers[id];
    return onPress ? [{ id, label: ADMIN_LABELS[id], onPress }] : [];
  });
}
