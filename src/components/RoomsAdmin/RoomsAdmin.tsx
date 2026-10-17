import {
  Button,
  Description,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
} from "@heroui/react";
import { useEffect, useState, type FormEvent } from "react";
import {
  MAX_FLOOR_NAME_LENGTH,
  sanitizeFloorName,
} from "../../../shared/floors.ts";
import { withToken } from "../../calendar/calendar";
import { httpUrlOf } from "../../editor/backend";
import {
  archiveRoom,
  createRoom,
  fetchRoomsAdmin,
  renameRoom,
  splitRooms,
  type AdminFloor,
  type RoomTemplate,
} from "../../floors/floors";
import { currentServerUrl } from "../../game/serverAddress";
import { ArchivedRooms } from "./ArchivedRooms";
import { RoomRename } from "./RoomRename";
import { RoomsTable } from "./RoomsTable";
import {
  ARCHIVED,
  CREATE_LABEL,
  CLOSE_LABEL,
  CREATED,
  EMPTY_NAME,
  INTRO,
  LOAD_ERROR,
  LOADING,
  NAME_LABEL,
  NAME_PLACEHOLDER,
  RENAMED,
  TEMPLATE_LABEL,
  TITLE,
  UNARCHIVED,
} from "./consts";
import * as styles from "./styles";
import type { RoomsAdminProps } from "./types";

/**
 * The rooms of the building, for the admins: which there are, and making a new
 * one. Who may enter each is set in the People screen. The game server checks
 * that the caller is an admin, whatever this screen shows.
 */
export function RoomsAdmin({ getToken, onClose }: RoomsAdminProps) {
  const [{ request, adminBase }] = useState(() => ({
    request: withToken(getToken),
    adminBase: `${httpUrlOf(currentServerUrl())}/admin`,
  }));
  const [rooms, setRooms] = useState<AdminFloor[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [templates, setTemplates] = useState<RoomTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<AdminFloor | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);

  useEffect(() => {
    void fetchRoomsAdmin(request, adminBase).then((found) => {
      setRooms(found?.floors ?? null);
      setTemplates(found?.templates ?? []);
      setTemplateId(found?.templates[0]?.id ?? "");
      setLoaded(true);
    });
  }, [request, adminBase]);

  const replaceRoom = (floor: AdminFloor) =>
    setRooms((now) =>
      (now ?? []).map((room) => (room.id === floor.id ? floor : room)),
    );

  const rename = async (room: AdminFloor, next: string) => {
    setBusy(true);
    setRenameError(null);
    const done = await renameRoom(request, adminBase, room.id, next);
    setBusy(false);
    if (!done.ok) {
      setRenameError(done.text);
      return;
    }
    replaceRoom(done.floor);
    setRenaming(null);
    setResult({ ok: true, text: RENAMED(done.floor.name) });
  };

  const archive = async (room: AdminFloor, archived: boolean) => {
    setResult(null);
    const done = await archiveRoom(request, adminBase, room.id, archived);
    if (!done.ok) {
      setResult({ ok: false, text: done.text });
      return;
    }
    replaceRoom(done.floor);
    setResult({
      ok: true,
      text: archived ? ARCHIVED(room.name) : UNARCHIVED(room.name),
    });
  };

  const { active, archived } = splitRooms(rooms ?? []);
  const chosen = templates.find((template) => template.id === templateId);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const clean = sanitizeFloorName(name);
    if (!clean) {
      setResult({ ok: false, text: EMPTY_NAME });
      return;
    }
    setBusy(true);
    const made = await createRoom(
      request,
      adminBase,
      clean,
      templateId || undefined,
    );
    setBusy(false);
    // A room can be made all the same when its template could not be applied: it is there, so it is listed
    const floor = made.floor;
    if (floor) setRooms((now) => [...(now ?? []), floor]);
    if (!made.ok) {
      setResult({ ok: false, text: made.text });
      return;
    }
    setName("");
    setResult({
      ok: true,
      text: CREATED(made.floor.name, chosen?.name ?? null),
    });
  };

  return (
    <>
      <Modal.Backdrop
        isOpen
        variant="blur"
        onOpenChange={(open) => !open && !renaming && onClose()}
      >
        <Modal.Container scroll="inside">
          <Modal.Dialog className={styles.dialog} aria-label={TITLE}>
            <Modal.Header>
              <Modal.Heading className={styles.title}>{TITLE}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className={styles.body}>
              <p className={styles.notice}>{INTRO}</p>
              {!loaded && <p className={styles.notice}>{LOADING}</p>}
              {loaded && rooms === null && (
                <p className={styles.error} role="alert">
                  {LOAD_ERROR}
                </p>
              )}
              {rooms && (
                <RoomsTable
                  rooms={active}
                  onRename={(room) => {
                    setRenameError(null);
                    setRenaming(room);
                  }}
                  onArchive={(room) => void archive(room, true)}
                />
              )}
              <Form className={styles.form} onSubmit={create}>
                <TextField
                  className={styles.field}
                  value={name}
                  onChange={(next) => {
                    setName(next);
                    setResult(null);
                  }}
                >
                  <Label>{NAME_LABEL}</Label>
                  <Input
                    fullWidth
                    maxLength={MAX_FLOOR_NAME_LENGTH}
                    placeholder={NAME_PLACEHOLDER}
                    autoComplete="off"
                  />
                </TextField>
                {templates.length > 0 && (
                  <Select
                    className={styles.field}
                    aria-label={TEMPLATE_LABEL}
                    value={templateId}
                    onChange={(next) => {
                      if (typeof next === "string") setTemplateId(next);
                    }}
                  >
                    <Label>{TEMPLATE_LABEL}</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {templates.map((template) => (
                          <ListBox.Item
                            key={template.id}
                            id={template.id}
                            textValue={template.name}
                          >
                            <div className={styles.templateText}>
                              <Label>{template.name}</Label>
                              <Description>{template.description}</Description>
                            </div>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                    {chosen && <Description>{chosen.description}</Description>}
                  </Select>
                )}
                <Button type="submit" isDisabled={busy || !loaded}>
                  {CREATE_LABEL}
                </Button>
              </Form>
              {result && (
                <p className={styles.result(result.ok)} role="status">
                  {result.text}
                </p>
              )}
              {archived.length > 0 && (
                <ArchivedRooms
                  rooms={archived}
                  onUnarchive={(room) => void archive(room, false)}
                  onRename={(room) => {
                    setRenameError(null);
                    setRenaming(room);
                  }}
                />
              )}
            </Modal.Body>
            <Modal.Footer className={styles.actions}>
              <Button variant="secondary" onPress={onClose}>
                {CLOSE_LABEL}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      {renaming && (
        <RoomRename
          key={renaming.id}
          room={renaming}
          busy={busy}
          error={renameError}
          onSave={(next) => void rename(renaming, next)}
          onCancel={() => setRenaming(null)}
        />
      )}
    </>
  );
}
