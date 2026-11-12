import "server-only";
import { readBedrockConfiguration } from "./config.ts";

/** Server runtime entry point; deliberately not imported by any Client Component. */
export function readServerBedrockConfiguration() {
  return readBedrockConfiguration(process.env);
}
