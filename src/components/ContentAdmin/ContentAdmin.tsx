import { Button, Label, ListBox, Modal, Select, Tabs } from "@heroui/react";
import { useState } from "react";
import {
  CONTENT_LIMITS,
  type ContentFields,
  type ContentItem,
  type ContentKind,
} from "../../../shared/content.ts";
import { withToken } from "../../calendar/calendar";
import {
  contentCache,
  deleteContent,
  fetchAdminContent,
  fetchEditableFloors,
  saveContent,
} from "../../content/content";
import { emptyForm, formOf } from "../../content/form";
import { useLoaded } from "../../content/useLoaded";
import { httpUrlOf } from "../../editor/backend";
import { currentServerUrl } from "../../game/serverAddress";
import { ContentNotice } from "../ContentNotice";
import { ContentEditor } from "./ContentEditor";
import { ContentList } from "./ContentList";
import {
  CLOSE_LABEL,
  COUNT,
  FLOORS_ERROR,
  INTRO,
  KIND_WORDS,
  NO_ROOMS,
  RETRY_LABEL,
  ROOM_LABEL,
  TABS,
  TITLE,
} from "./consts";
import * as styles from "./styles";
import type { ContentAdminProps } from "./types";

/** What is being edited in the form: a new item, or a change to this one. */
interface Editing {
  kind: ContentKind;
  item: ContentItem | null;
}

/**
 * The books and the announcements of each room, for the admins and for the head
 * of a room (only their own). The game server checks who may on every call,
 * whatever this screen shows.
 */
export function ContentAdmin({ getToken, onClose }: ContentAdminProps) {
  const [{ request, adminBase }] = useState(() => ({
    request: withToken(getToken),
    adminBase: `${httpUrlOf(currentServerUrl())}/admin`,
  }));
  const floorsLoad = useLoaded(
    () => fetchEditableFloors(request, adminBase),
    "floors",
  );
  const [chosen, setChosen] = useState<string | null>(null);
  const [tab, setTab] = useState<ContentKind>("book");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const floors =
    floorsLoad.state.status === "ready" ? floorsLoad.state.value.floors : [];
  const floorId =
    chosen && floors.some((floor) => floor.id === chosen)
      ? chosen
      : (floors[0]?.id ?? null);

  const content = useLoaded(
    () =>
      floorId
        ? fetchAdminContent(request, adminBase, floorId)
        : Promise.resolve({ ok: false as const, text: "" }),
    floorId ?? "none",
  );

  const save = async (fields: ContentFields) => {
    if (!editing || !floorId) return;
    setBusy(true);
    setSaveError(null);
    const result = await saveContent(request, adminBase, {
      id: editing.item?.id,
      floor: floorId,
      kind: editing.kind,
      fields,
    });
    setBusy(false);
    if (!result.ok) {
      setSaveError(result.text);
      return;
    }
    contentCache.clear(floorId);
    setEditing(null);
    content.retry();
  };

  const remove = async (item: ContentItem) => {
    setListError(null);
    const result = await deleteContent(request, adminBase, item.id);
    if (!result.ok) {
      setListError(result.text);
      return;
    }
    contentCache.clear(item.floor);
    content.retry();
  };

  const startEditing = (next: Editing) => {
    setSaveError(null);
    setEditing(next);
  };

  const ready = content.state.status === "ready" ? content.state.value : null;

  return (
    <>
      <Modal.Backdrop
        isOpen
        variant="blur"
        onOpenChange={(open) => !open && !editing && onClose()}
      >
        <Modal.Container scroll="inside">
          <Modal.Dialog className={styles.dialog} aria-label={TITLE}>
            <Modal.Header>
              <Modal.Heading className={styles.title}>{TITLE}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className={styles.body}>
              <p className={styles.notice}>{INTRO}</p>
              {floorsLoad.state.status === "loading" && (
                <ContentNotice
                  state={floorsLoad.state}
                  onRetry={floorsLoad.retry}
                />
              )}
              {floorsLoad.state.status === "error" && (
                <>
                  <p className={styles.error} role="alert">
                    {FLOORS_ERROR}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={floorsLoad.retry}
                  >
                    {RETRY_LABEL}
                  </Button>
                </>
              )}
              {floorsLoad.state.status === "ready" && floors.length === 0 && (
                <p className={styles.notice}>{NO_ROOMS}</p>
              )}
              {floorId && (
                <>
                  <Select
                    className={styles.room}
                    aria-label={ROOM_LABEL}
                    value={floorId}
                    onChange={(next) => {
                      if (typeof next === "string") setChosen(next);
                    }}
                  >
                    <Label>{ROOM_LABEL}</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {floors.map((floor) => (
                          <ListBox.Item
                            key={floor.id}
                            id={floor.id}
                            textValue={floor.name}
                          >
                            {floor.name}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  {content.state.status !== "ready" ? (
                    <ContentNotice
                      state={content.state}
                      onRetry={content.retry}
                    />
                  ) : (
                    <Tabs
                      selectedKey={tab}
                      onSelectionChange={(key) => setTab(key as ContentKind)}
                    >
                      <Tabs.ListContainer>
                        <Tabs.List aria-label={TITLE}>
                          {TABS.map(({ id, label }) => (
                            <Tabs.Tab key={id} id={id}>
                              {label}
                              <Tabs.Indicator />
                            </Tabs.Tab>
                          ))}
                        </Tabs.List>
                      </Tabs.ListContainer>
                      {TABS.map(({ id }) => {
                        const items =
                          (id === "book"
                            ? ready?.books
                            : ready?.announcements) ?? [];
                        const words = KIND_WORDS[id];
                        return (
                          <Tabs.Panel
                            key={id}
                            id={id}
                            className={styles.tabPanel}
                          >
                            <div className={styles.toolbar}>
                              <span className={styles.count}>
                                {COUNT(
                                  items.length,
                                  CONTENT_LIMITS.perKind,
                                  words.many,
                                )}
                              </span>
                              <Button
                                size="sm"
                                isDisabled={
                                  items.length >= CONTENT_LIMITS.perKind
                                }
                                onPress={() =>
                                  startEditing({ kind: id, item: null })
                                }
                              >
                                {words.add}
                              </Button>
                            </div>
                            <ContentList
                              kind={id}
                              items={items}
                              onEdit={(item) =>
                                startEditing({ kind: id, item })
                              }
                              onDelete={(item) => void remove(item)}
                            />
                          </Tabs.Panel>
                        );
                      })}
                    </Tabs>
                  )}
                  {listError && (
                    <p className={styles.error} role="alert">
                      {listError}
                    </p>
                  )}
                </>
              )}
            </Modal.Body>
            <Modal.Footer className={styles.footer}>
              <Button variant="secondary" onPress={onClose}>
                {CLOSE_LABEL}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      {editing && (
        <ContentEditor
          key={editing.item?.id ?? `new-${editing.kind}`}
          kind={editing.kind}
          initial={editing.item ? formOf(editing.item) : emptyForm()}
          isNew={editing.item === null}
          busy={busy}
          error={saveError}
          onSave={(fields) => void save(fields)}
          onCancel={() => setEditing(null)}
        />
      )}
    </>
  );
}
