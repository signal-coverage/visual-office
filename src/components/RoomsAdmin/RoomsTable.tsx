import { Button, Chip, Table } from "@heroui/react";
import { useState } from "react";
import type { AdminFloor } from "../../floors/floors";
import {
  ARCHIVE_LABEL,
  CANCEL_LABEL,
  COLUMNS,
  COMMON_LABEL,
  CONFIRM_LABEL,
  confirmArchive,
  RENAME_LABEL,
  TITLE,
} from "./consts";
import * as styles from "./styles";

export interface RoomsTableProps {
  rooms: readonly AdminFloor[];
  onRename: (room: AdminFloor) => void;
  onArchive: (room: AdminFloor) => void;
}

/** The rooms in use, each with Rename and Archive (which asks first). The common room cannot be archived. */
export function RoomsTable({ rooms, onRename, onArchive }: RoomsTableProps) {
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label={TITLE}>
          <Table.Header>
            <Table.Column id="name" isRowHeader>
              {COLUMNS.name}
            </Table.Column>
            <Table.Column id="id">{COLUMNS.id}</Table.Column>
            <Table.Column id="actions" className="text-end">
              {COLUMNS.actions}
            </Table.Column>
          </Table.Header>
          <Table.Body>
            {rooms.map((room) => (
              <Table.Row key={room.id} id={room.id}>
                <Table.Cell>
                  {room.name}
                  {room.common && (
                    <Chip size="sm" color="accent" className={styles.badge}>
                      {COMMON_LABEL}
                    </Chip>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <code className={styles.code}>{room.id}</code>
                </Table.Cell>
                <Table.Cell>
                  {confirming === room.id ? (
                    <div className={styles.rowActions}>
                      <p className={styles.question}>
                        {confirmArchive(room.name)}
                      </p>
                      <Button
                        size="sm"
                        variant="danger"
                        onPress={() => {
                          setConfirming(null);
                          onArchive(room);
                        }}
                      >
                        {CONFIRM_LABEL}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => setConfirming(null)}
                      >
                        {CANCEL_LABEL}
                      </Button>
                    </div>
                  ) : (
                    <div className={styles.rowActions}>
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`${RENAME_LABEL} ${room.name}`}
                        onPress={() => onRename(room)}
                      >
                        {RENAME_LABEL}
                      </Button>
                      {!room.common && (
                        <Button
                          size="sm"
                          variant="danger-soft"
                          aria-label={`${ARCHIVE_LABEL} ${room.name}`}
                          onPress={() => setConfirming(room.id)}
                        >
                          {ARCHIVE_LABEL}
                        </Button>
                      )}
                    </div>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
