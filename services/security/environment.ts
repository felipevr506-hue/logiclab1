import "server-only";

export type AppEnvironment =
  | "development"
  | "test"
  | "staging"
  | "production";

const knownEnvironments = new Set<AppEnvironment>([
  "development",
  "test",
  "staging",
  "production",
]);

export function appEnvironment(): AppEnvironment {
  const configured = process.env.APP_ENV?.trim().toLowerCase();
  if (configured && knownEnvironments.has(configured as AppEnvironment))
    return configured as AppEnvironment;
  return process.env.NODE_ENV === "development" ? "development" : "production";
}

export function isProductionLike() {
  const environment = appEnvironment();
  return environment === "production" || environment === "staging";
}

export function allowsLocalDevelopmentFeatures() {
  return !isProductionLike();
}

export function isAutomatedTestHarness() {
  return (
    process.env.NODE_ENV === "development" &&
    appEnvironment() === "test" &&
    process.env.TEST_AUTH_ROLE === "ADMIN"
  );
}
