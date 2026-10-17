export const TITLE = "Rooms";
export const INTRO =
  "The rooms of the building. Everybody can enter the common room; for the others, say who may enter in People, or give a whole set of people the same rooms in Groups. A new room starts from a template: its shape, walls, private rooms and furniture. The structure of a room that exists can be changed in the editor (Structure mode, Apply template). A room you archive disappears for everybody (the people inside are sent to the main office) but keeps its layout, content and entries, and comes back when you unarchive it.";
export const LOADING = "Loading…";
export const LOAD_ERROR = "Could not load the rooms. Try again in a moment.";
export const COLUMNS = {
  name: "Room",
  id: "Id",
  archivedOn: "Archived on",
  actions: "Actions",
} as const;
export const COMMON_LABEL = "Common";
export const NAME_LABEL = "New room";
export const NAME_PLACEHOLDER = "e.g. Human Resources";
export const CREATE_LABEL = "Make the room";
export const CLOSE_LABEL = "Back";
export const EMPTY_NAME = "Give the room a name.";
export const TEMPLATE_LABEL = "Template";
export const CREATED = (name: string, template: string | null) =>
  `Made ${name}${template ? ` from the ${template} template` : ""}. Say who may enter it in People or in Groups.`;

export const RENAME_LABEL = "Rename";
export const ARCHIVE_LABEL = "Archive";
export const UNARCHIVE_LABEL = "Unarchive";
export const CONFIRM_LABEL = "Yes, archive it";
export const CANCEL_LABEL = "Cancel";
export const confirmArchive = (name: string) =>
  `Archive ${name}? It disappears for everybody and the people inside go to the main office. Nothing is deleted.`;
export const ARCHIVED = (name: string) =>
  `Archived ${name}. You can bring it back below.`;
export const UNARCHIVED = (name: string) => `${name} is back.`;
export const RENAMED = (name: string) => `Renamed to ${name}.`;

export const ARCHIVED_TITLE = "Archived";
export const ARCHIVED_INTRO =
  "Hidden from everybody. Unarchive a room to bring back its layout, content and who may enter it.";
export const archivedOn = (at: number) =>
  new Date(at).toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export const RENAME = {
  title: "Rename the room",
  name: "Name",
  hint: "The id stays the same, so links and entries keep working.",
  save: "Save",
  saving: "Saving…",
  cancel: "Cancel",
} as const;
