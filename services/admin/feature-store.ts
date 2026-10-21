import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { serverDataDirectory } from "@/services/persistence/server-data-directory";
import type { FeatureFlagKey } from "@/lib/types";

export const DEFAULT_FEATURE_FLAGS: Record<FeatureFlagKey, boolean> = {
  AI_TUTOR: true,
  PLAYGROUND: true,
  DAILY_CHALLENGE: true,
  WEEKLY_MISSIONS: true,
  PYTHON_TRACK: true,
  JAVA_TRACK: true,
  C_TRACK: true,
  CPP_TRACK: true,
  PORTFOLIO: true,
  INTERVIEW_MODE: false,
};

const configDirectory = serverDataDirectory("config");
const configFile = path.join(configDirectory, "features.json");
let writeQueue = Promise.resolve();

export function isFeatureFlagKey(value: string): value is FeatureFlagKey {
  return value in DEFAULT_FEATURE_FLAGS;
}

export async function readFeatureFlags() {
  try {
    const saved = JSON.parse(await readFile(configFile, "utf8")) as Partial<
      Record<FeatureFlagKey, boolean>
    >;
    return { ...DEFAULT_FEATURE_FLAGS, ...saved };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return DEFAULT_FEATURE_FLAGS;
    throw error;
  }
}

export async function setFeatureFlag(key: FeatureFlagKey, enabled: boolean) {
  let flags = DEFAULT_FEATURE_FLAGS;
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    flags = { ...(await readFeatureFlags()), [key]: enabled };
    await mkdir(configDirectory, { recursive: true });
    const temporary = `${configFile}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(flags), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, configFile);
  });
  await writeQueue;
  return flags;
}
