import {
  OrganizationProfile,
  useOrganization,
  useOrganizationList,
} from "@clerk/react";
import { Button } from "@heroui/react";
import { useEffect } from "react";
import * as styles from "./styles";

export interface InvitePeopleProps {
  /** The company's organization: where the invitations are for. */
  organizationId: string;
  /** Goes back to the office menu. */
  onClose: () => void;
}

/**
 * Inviting people to the company, for its admin: Clerk's own members screen,
 * which sends the invitation emails. The organization has to be the active one
 * for it to show, so it is made active first.
 */
export function InvitePeople({ organizationId, onClose }: InvitePeopleProps) {
  const { organization } = useOrganization();
  const { isLoaded, setActive } = useOrganizationList();
  const ready = organization?.id === organizationId;

  useEffect(() => {
    if (ready || !isLoaded || !setActive) return;
    void setActive({ organization: organizationId });
  }, [ready, isLoaded, setActive, organizationId]);

  return (
    <div className={styles.page}>
      <header className={styles.toolbar}>
        <Button variant="secondary" size="sm" onPress={onClose}>
          Back
        </Button>
        <h1 className={styles.title}>Invite people</h1>
      </header>
      <main className={styles.body}>
        {ready ? (
          <OrganizationProfile routing="hash" />
        ) : (
          <p className={styles.loading}>Loading…</p>
        )}
      </main>
    </div>
  );
}
