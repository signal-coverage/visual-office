import {
  Button,
  Chip,
  Form,
  Input,
  Label,
  Modal,
  Table,
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
  createRoom,
  fetchRoomsAdmin,
  type AdminFloor,
} from "../../floors/floors";
import { currentServerUrl } from "../../game/serverAddress";
import {
  COMMON_LABEL,
  CREATE_LABEL,
  CLOSE_LABEL,
  COLUMNS,
  CREATED,
  EMPTY_NAME,
  INTRO,
  LOAD_ERROR,
  LOADING,
  NAME_LABEL,
  NAME_PLACEHOLDER,
  TITLE,
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
  const [name, setName] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchRoomsAdmin(request, adminBase).then((found) => {
      setRooms(found);
      setLoaded(true);
    });
  }, [request, adminBase]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const clean = sanitizeFloorName(name);
    if (!clean) {
      setResult({ ok: false, text: EMPTY_NAME });
      return;
    }
    setBusy(true);
    const made = await createRoom(request, adminBase, clean);
    setBusy(false);
    if (!made.ok) {
      setResult({ ok: false, text: made.text });
      return;
    }
    setName("");
    setResult({ ok: true, text: CREATED(made.floor.name) });
    setRooms((now) => [...(now ?? []), made.floor]);
  };

  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(open) => !open && onClose()}
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
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label={TITLE}>
                    <Table.Header>
                      <Table.Column id="name" isRowHeader>
                        {COLUMNS.name}
                      </Table.Column>
                      <Table.Column id="id">{COLUMNS.id}</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {rooms.map((room) => (
                        <Table.Row key={room.id} id={room.id}>
                          <Table.Cell>
                            {room.name}
                            {room.common && (
                              <Chip
                                size="sm"
                                color="accent"
                                className={styles.badge}
                              >
                                {COMMON_LABEL}
                              </Chip>
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            <code className={styles.code}>{room.id}</code>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
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
              <Button type="submit" isDisabled={busy || !loaded}>
                {CREATE_LABEL}
              </Button>
            </Form>
            {result && (
              <p className={styles.result(result.ok)} role="status">
                {result.text}
              </p>
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
  );
}
