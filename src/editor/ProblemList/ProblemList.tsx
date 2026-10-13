import { Alert, Button } from "@heroui/react";
import * as styles from "./styles";
import type { ProblemListProps } from "./types";

export function ProblemList({ problems, onSelect }: ProblemListProps) {
  return (
    <section className={styles.box}>
      <h2 className={styles.heading}>Problems</h2>
      {problems.length === 0 ? (
        <Alert status="success" className={styles.fine}>
          <Alert.Content>
            <Alert.Description>
              Nothing wrong with this layout.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : (
        <ul className={styles.list}>
          {problems.map((problem, i) => (
            <li key={`${problem.code}-${i}`}>
              <Button
                variant="outline"
                className={styles.problem}
                onPress={() => {
                  if (problem.targets[0]) onSelect(problem.targets[0]);
                }}
              >
                {problem.message}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
