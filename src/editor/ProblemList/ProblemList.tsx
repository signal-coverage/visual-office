import { Alert, Button } from "@heroui/react";
import { blocking } from "../problems";
import * as styles from "./styles";
import type { ProblemListProps } from "./types";

export function ProblemList({ problems, onSelect }: ProblemListProps) {
  const errors = blocking(problems);
  return (
    <section className={styles.box}>
      <h2 className={styles.heading}>Problems</h2>
      {errors > 0 && (
        <p className={styles.blocked} role="status">
          {errors === 1
            ? "1 error has to be fixed before publishing."
            : `${errors} errors have to be fixed before publishing.`}
        </p>
      )}
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
            <li key={`${problem.level}-${i}`}>
              <Button
                variant="outline"
                className={styles.problem(problem.level === "error")}
                onPress={() => onSelect(problem)}
              >
                <span className={styles.level}>{problem.level}</span>
                {problem.message}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
