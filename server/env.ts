// Imported first by the server, so the variables are there before anything reads them
import { loadEnvIfPresent } from "./loadEnv.ts";

// What is already in the environment wins, then .env.local (yours alone), then .env
loadEnvIfPresent(".env.local");
loadEnvIfPresent(".env");
