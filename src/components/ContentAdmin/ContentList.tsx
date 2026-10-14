import { Button, Chip, Table } from "@heroui/react";
import { useState } from "react";
import type { ContentItem, ContentKind } from "../../../shared/content.ts";
import { postedText } from "../../content/format";
import {
  CANCEL_LABEL,
  COLUMNS,
  CONFIRM_DELETE,
  CONFIRM_LABEL,
  DELETE_LABEL,
  EDIT_LABEL,
  HAS_LINK,
  KIND_WORDS,
  PINNED,
  TABLE_LABEL,
} from "./consts";
import * as styles from "./styles";

export interface ContentListProps {
  kind: ContentKind;
  items: ContentItem[];
  onEdit: (item: ContentItem) => void;
  onDelete: (item: ContentItem) => void;
}

/** The books or the announcements of a room, each with Edit and Delete (which asks first). */
export function ContentList({
  kind,
  items,
  onEdit,
  onDelete,
}: ContentListProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const words = KIND_WORDS[kind];
  if (items.length === 0) return <p className={styles.notice}>{words.empty}</p>;

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label={TABLE_LABEL(words.many)}>
          <Table.Header>
            <Table.Column id="title" isRowHeader>
              {COLUMNS.title}
            </Table.Column>
            <Table.Column id="detail">
              {kind === "book" ? COLUMNS.author : COLUMNS.updated}
            </Table.Column>
            <Table.Column id="actions" className="text-end">
              {COLUMNS.actions}
            </Table.Column>
          </Table.Header>
          <Table.Body>
            {items.map((item) => (
              <Table.Row key={item.id} id={item.id}>
                <Table.Cell>
                  <span className={styles.itemTitle}>{item.title}</span>
                  {item.pinned && (
                    <Chip size="sm" color="accent" className={styles.badge}>
                      {PINNED}
                    </Chip>
                  )}
                  {item.link && (
                    <Chip size="sm" className={styles.badge}>
                      {HAS_LINK}
                    </Chip>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <span className={styles.small}>
                    {kind === "book" ? item.author : postedText(item.updatedAt)}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  {confirming === item.id ? (
                    <div className={styles.actions}>
                      <p className={styles.question}>
                        {CONFIRM_DELETE(item.title)}
                      </p>
                      <Button
                        size="sm"
                        variant="danger"
                        onPress={() => {
                          setConfirming(null);
                          onDelete(item);
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
                    <div className={styles.actions}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => onEdit(item)}
                      >
                        {EDIT_LABEL}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger-soft"
                        onPress={() => setConfirming(item.id)}
                      >
                        {DELETE_LABEL}
                      </Button>
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
