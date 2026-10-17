import { STACK_ENV } from "./env.ts";

Object.assign(process.env, STACK_ENV);

if (process.env.DATABASE_URL) {
  console.error("The end-to-end server must never have a database.");
  process.exit(1);
}

await import("../server/index.ts");
