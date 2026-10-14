import {
  CONTENT_LIMITS,
  validateContentFields,
  type ContentErrors,
  type ContentFields,
  type ContentItem,
  type ContentKind,
} from "../../shared/content.ts";

/** What is typed in the editor: all text, as typed. */
export interface ContentForm {
  title: string;
  author: string;
  body: string;
  link: string;
  pinned: boolean;
}

export const emptyForm = (): ContentForm => ({
  title: "",
  author: "",
  body: "",
  link: "",
  pinned: false,
});

export const formOf = (item: ContentItem): ContentForm => ({
  title: item.title,
  author: item.author,
  body: item.body,
  link: item.link ?? "",
  pinned: item.pinned,
});

export type FormValidation =
  { ok: true; fields: ContentFields } | { ok: false; errors: ContentErrors };

/** The same checks the server makes (shared/content.ts), so what passes here is not refused there. */
export function validateForm(
  kind: ContentKind,
  form: ContentForm,
): FormValidation {
  return validateContentFields(
    kind,
    kind === "book"
      ? {
          title: form.title,
          author: form.author,
          body: form.body,
          link: form.link,
        }
      : {
          title: form.title,
          body: form.body,
          link: form.link,
          pinned: form.pinned,
        },
  );
}

/** How many characters a field may have, for the counters beside it. */
export function limitOf(
  kind: ContentKind,
  field: "title" | "author" | "body" | "link",
): number {
  switch (field) {
    case "title":
      return CONTENT_LIMITS.titleMax;
    case "author":
      return CONTENT_LIMITS.authorMax;
    case "link":
      return CONTENT_LIMITS.linkMax;
    case "body":
      return kind === "book"
        ? CONTENT_LIMITS.bookBodyMax
        : CONTENT_LIMITS.announcementBodyMax;
  }
}
