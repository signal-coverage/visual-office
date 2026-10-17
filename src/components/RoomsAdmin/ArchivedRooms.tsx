import { Button, Table } from "@heroui/react";
import type { AdminFloor } from "../../floors/floors";
import {
  archivedOn,
  ARCHIVED_INTRO,
  ARCHIVED_TITLE,
  COLUMNS,
  RENAME_LABEL,
  UNARCHIVE_LABEL,
} from "./consts";
import * as styles from "./styles";

export interface ArchivedRoomsProps {
  rooms: readonly AdminFloor[];
  onUnarchive: (room: AdminFloor) => void;
  onRename: (room: AdminFloor) => void;
}

/** The rooms that were archived: hidden from everybody, kept with everything they had, and ready to be brought back. */
export function ArchivedRooms({
  rooms,
  onUnarchive,
  onRename,
}: ArchivedRoomsProps) {
  return (
    <section className={styles.section} aria-label={ARCHIVED_TITLE}>
      <h3 className={styles.sectionTitle}>{ARCHIVED_TITLE}</h3>
      <p className={styles.notice}>{ARCHIVED_INTRO}</p>
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label={ARCHIVED_TITLE}>
            <Table.Header>
              <Table.Column id="name" isRowHeader>
                {COLUMNS.name}
              </Table.Column>
              <Table.Column id="archivedOn">{COLUMNS.archivedOn}</Table.Column>
              <Table.Column id="actions" className="text-end">
                {COLUMNS.actions}
              </Table.Column>
            </Table.Header>
            <Table.Body>
              {rooms.map((room) => (
                <Table.Row key={room.id} id={room.id}>
                  <Table.Cell>
                    {room.name}
                    <code className={styles.badge}>{room.id}</code>
                  </Table.Cell>
                  <Table.Cell>
                    <span className={styles.code}>
                      {room.archivedAt === undefined
                        ? ""
                        : archivedOn(room.archivedAt)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className={styles.rowActions}>
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`${RENAME_LABEL} ${room.name}`}
                        onPress={() => onRename(room)}
                      >
                        {RENAME_LABEL}
                      </Button>
                      <Button
                        size="sm"
                        aria-label={`${UNARCHIVE_LABEL} ${room.name}`}
                        onPress={() => onUnarchive(room)}
                      >
                        {UNARCHIVE_LABEL}
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </section>
  );
}
