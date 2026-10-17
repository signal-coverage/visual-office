export const TITLE = "Groups";
export const INTRO =
  "A group gives the same rooms to a set of people, so you do not tick them one by one in People. For example, a group called Human Resources with every room, and the people in HR in it. Everybody can enter the common room anyway. Taking a room or a person out of a group moves out whoever had no other way in.";
export const LOADING = "Loading…";
export const LOAD_ERROR = "Could not load the groups. Try again in a moment.";
export const EMPTY = "There are no groups yet.";
export const CLOSE_LABEL = "Back";
export const NEW_LABEL = "New group";
export const COLUMNS = {
  name: "Group",
  rooms: "Rooms",
  people: "People",
  actions: "Actions",
} as const;
export const NO_ROOMS = "No rooms";
export const peopleCount = (count: number) =>
  `${count} ${count === 1 ? "person" : "people"}`;
export const EDIT_LABEL = "Edit";
export const DELETE_LABEL = "Delete";
export const CONFIRM_LABEL = "Yes, delete it";
export const CANCEL_LABEL = "Cancel";
export const confirmDelete = (name: string) =>
  `Delete the group ${name}? Its people lose the rooms it gave them, unless they can enter them another way.`;
export const DELETED = (name: string) => `Deleted the group ${name}.`;
export const SAVED = (name: string) => `Saved the group ${name}.`;
export const DELETE_ERROR = "Could not delete the group. Try again.";
export const partialSave = (done: number, total: number, text: string) =>
  `Saved ${done} of ${total} changes, then it stopped: ${text}`;

export const EDITOR = {
  newTitle: "New group",
  editTitle: "Edit group",
  name: "Name",
  namePlaceholder: "e.g. Human Resources",
  rooms: "Rooms this group can enter",
  roomsHint:
    "The common room is not listed: everybody can enter it. Archived rooms are only listed while the group still has them.",
  noRooms: "There are no other rooms yet. Make one in Rooms.",
  archived: "archived",
  people: "People in this group",
  search: "Search people",
  searchPlaceholder: "Name or email",
  noPeople: "Nobody has signed in yet.",
  noMatches: "Nobody matches that search.",
  save: "Save",
  saving: "Saving…",
  cancel: "Cancel",
} as const;
export const roomsCount = (used: number, max: number) =>
  `${used} of ${max} rooms`;
export const selectedCount = (used: number, max: number) =>
  `${used} of ${max} people selected`;
