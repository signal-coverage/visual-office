/**
 * Reads a settings file (.env) into the environment when there is one. What the
 * environment already has is kept, so the variables a host sets (Railway) win
 * over a file, and a server without the file just carries on.
 */
export function loadEnvIfPresent(file = ".env"): void {
  try {
    process.loadEnvFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
