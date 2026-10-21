import "server-only";

import path from "node:path";
import { allowsLocalDevelopmentFeatures } from "@/services/security/environment";

type DataArea =
  | "config"
  | "progress"
  | "support"
  | "security"
  | "observability";

export function serverDataDirectory(area: DataArea) {
  const projectRoot = process.cwd();
  const namespace = process.env.LOGICLAB_DATA_NAMESPACE;
  if (!namespace || !allowsLocalDevelopmentFeatures())
    return path.join(projectRoot, ".data", area);

  if (!/^[a-z0-9][a-z0-9-]{0,79}$/i.test(namespace))
    throw new Error("LOGICLAB_DATA_NAMESPACE inválido.");
  return path.join(projectRoot, ".tmp", namespace, area);
}
