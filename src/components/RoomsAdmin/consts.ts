export const TITLE = "Rooms";
export const INTRO =
  "The rooms of the building. Everybody can enter the common room; for the others, say who may enter in People. All rooms share the same walls and zones for now, and start with the default layout.";
export const LOADING = "Loading…";
export const LOAD_ERROR = "Could not load the rooms. Try again in a moment.";
export const COLUMNS = { name: "Room", id: "Id" } as const;
export const COMMON_LABEL = "Common";
export const NAME_LABEL = "New room";
export const NAME_PLACEHOLDER = "e.g. Human Resources";
export const CREATE_LABEL = "Make the room";
export const CLOSE_LABEL = "Back";
export const EMPTY_NAME = "Give the room a name.";
export const CREATED = (name: string) =>
  `Made ${name}. Say who may enter it in People.`;
