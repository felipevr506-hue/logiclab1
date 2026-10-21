import type { OfficialProgress } from "@/lib/trusted-progress";
import type {
  AttemptResponse,
  Submission,
} from "@/services/attempts/attempt-store";

const headers = {
  "content-type": "application/json",
  "x-logiclab-request": "same-origin",
};
export async function requestOfficialHint(ownerId: string, exerciseId: string) {
  const response = await fetch("/api/attempts/hint", {
    method: "POST",
    headers,
    body: JSON.stringify({ exerciseId }),
  });
  const data = (await response.json()) as {
    official: OfficialProgress;
    hintCount: number;
    error?: string;
  };
  if (!response.ok || data.official?.ownerId !== ownerId)
    throw new Error(data.error ?? "A dica não foi confirmada pelo servidor.");
  return data;
}
export async function loadOfficialProgress(ownerId: string) {
  const response = await fetch("/api/attempts", { cache: "no-store" });
  const data = (await response.json()) as {
    official?: OfficialProgress;
    error?: string;
  };
  if (!response.ok || data.official?.ownerId !== ownerId)
    throw new Error(data.error ?? "Progresso oficial indisponível.");
  return data.official;
}
export async function sendOfficialAttempt(
  ownerId: string,
  submission: Submission,
) {
  const response = await fetch("/api/attempts", {
    method: "POST",
    headers,
    body: JSON.stringify(submission),
  });
  const data = (await response.json()) as AttemptResponse & { error?: string };
  if (!response.ok || data.official?.ownerId !== ownerId)
    throw new Error(
      data.error ?? "A tentativa não foi confirmada pelo servidor.",
    );
  return data;
}
export async function claimOfficialProgress(
  ownerId: string,
  projectId?: string,
) {
  const response = await fetch("/api/attempts/claim", {
    method: "POST",
    headers,
    body: JSON.stringify({ projectId }),
  });
  const data = (await response.json()) as {
    official?: OfficialProgress;
    error?: string;
  };
  if (!response.ok || data.official?.ownerId !== ownerId)
    throw new Error(data.error ?? "A recompensa não foi confirmada.");
  return data.official;
}
