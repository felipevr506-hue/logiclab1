import type { AppState, CodeVersion } from "@/lib/types";
import { trustedFields } from "@/lib/trusted-progress";

export type RemoteProgressSnapshot = {
  account: string;
  revision: number;
  updatedAt: string;
  state: AppState;
};

export type SyncIndicator = {
  status: "local" | "saving" | "saved" | "offline" | "error" | "conflict";
  message: string;
  lastSyncedAt?: string;
};

function uniqueBy<T>(values: T[], key: (value: T) => string) {
  return [...new Map(values.map((value) => [key(value), value])).values()];
}

function conflictVersions(local: AppState, remote: AppState) {
  const versions: CodeVersion[] = [];
  for (const sourceId of new Set([
    ...Object.keys(local.drafts),
    ...Object.keys(remote.drafts),
  ])) {
    const localCode = local.drafts[sourceId];
    const remoteCode = remote.drafts[sourceId];
    if (!localCode || !remoteCode || localCode === remoteCode) continue;
    const createdAt = new Date().toISOString();
    const playgroundLanguage = sourceId.startsWith("playground:")
      ? sourceId.slice("playground:".length)
      : "javascript";
    const language = ["javascript", "python", "java", "c", "cpp"].includes(
      playgroundLanguage,
    )
      ? (playgroundLanguage as CodeVersion["language"])
      : "javascript";
    versions.push(
      {
        id: `conflict-local-${sourceId}-${Date.now()}`,
        scope: sourceId.startsWith("playground:") ? "playground" : "exercise",
        sourceId,
        language,
        code: localCode,
        reason: "conflict",
        createdAt,
      },
      {
        id: `conflict-remote-${sourceId}-${Date.now()}`,
        scope: sourceId.startsWith("playground:") ? "playground" : "exercise",
        sourceId,
        language,
        code: remoteCode,
        reason: "conflict",
        createdAt,
      },
    );
  }
  return versions;
}

export function mergeProgressStates(local: AppState, remote: AppState) {
  if (
    local.user.accountId !== remote.user.accountId ||
    (!local.user.accountId &&
      local.user.email.trim().toLowerCase() !==
        remote.user.email.trim().toLowerCase())
  ) {
    throw new Error("Cannot merge progress belonging to different accounts.");
  }
  const trainingStartedOn = [
    local.user.trainingStartedOn,
    remote.user.trainingStartedOn,
  ]
    .filter((value): value is string => Boolean(value))
    .toSorted()[0];
  const tutorKeys = new Set([
    ...Object.keys(local.tutorMessages),
    ...Object.keys(remote.tutorMessages),
  ]);
  const tutorMessages = Object.fromEntries(
    [...tutorKeys].map((key) => [
      key,
      uniqueBy(
        [
          ...(remote.tutorMessages[key] ?? []),
          ...(local.tutorMessages[key] ?? []),
        ],
        (message) => message.id,
      ).toSorted((a, b) => a.createdAt.localeCompare(b.createdAt)),
    ]),
  );
  return {
    ...remote,
    ...local,
    ...trustedFields(local),
    hydrated: true,
    user: { ...remote.user, ...local.user, trainingStartedOn },
    tutorMessages,
    drafts: { ...remote.drafts, ...local.drafts },
    notes: { ...remote.notes, ...local.notes },
    favorites: uniqueBy([...remote.favorites, ...local.favorites], String),
    codeVersions: uniqueBy(
      [
        ...remote.codeVersions,
        ...local.codeVersions,
        ...conflictVersions(local, remote),
      ],
      (version) => version.id,
    ),
    savedTutorExplanations: uniqueBy(
      [...remote.savedTutorExplanations, ...local.savedTutorExplanations],
      (item) => item.id,
    ),
    savedCodeSnippets: uniqueBy(
      [...remote.savedCodeSnippets, ...local.savedCodeSnippets],
      (item) => item.id,
    ),
    favoriteProjects: uniqueBy(
      [...remote.favoriteProjects, ...local.favoriteProjects],
      String,
    ),
    favoriteConcepts: uniqueBy(
      [...remote.favoriteConcepts, ...local.favoriteConcepts],
      String,
    ),
    exerciseFeedback: uniqueBy(
      [...remote.exerciseFeedback, ...local.exerciseFeedback],
      (item) => item.id,
    ),
  } satisfies AppState;
}

export async function loadRemoteProgress(account: string, ownerId?: string) {
  const response = await fetch(
    `/api/progress?account=${encodeURIComponent(account)}${ownerId ? `&ownerId=${encodeURIComponent(ownerId)}` : ""}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("Falha ao carregar o backup remoto.");
  const payload = (await response.json()) as {
    snapshot: RemoteProgressSnapshot | null;
    ownerId?: string;
  };
  if (ownerId && payload.ownerId !== ownerId)
    throw new Error("Progress owner mismatch.");
  if (payload.snapshot) assertSnapshotOwner(payload.snapshot, account, ownerId);
  return payload.snapshot;
}

export async function saveRemoteProgress(
  account: string,
  baseRevision: number,
  state: AppState,
  ownerId?: string,
) {
  const response = await fetch("/api/progress", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-logiclab-request": "same-origin",
    },
    body: JSON.stringify({ account, baseRevision, state, ownerId }),
  });
  const payload = (await response.json()) as {
    snapshot?: RemoteProgressSnapshot;
    conflict?: boolean;
    error?: string;
    ownerId?: string;
  };
  if (payload.snapshot) {
    if (ownerId && payload.ownerId !== ownerId)
      throw new Error("Progress owner mismatch.");
    assertSnapshotOwner(payload.snapshot, account, ownerId);
  }
  if (response.status === 409 && payload.snapshot)
    return { kind: "conflict" as const, snapshot: payload.snapshot };
  if (!response.ok || !payload.snapshot)
    throw new Error(payload.error ?? "Falha ao sincronizar o progresso.");
  return { kind: "saved" as const, snapshot: payload.snapshot };
}

function assertSnapshotOwner(
  snapshot: RemoteProgressSnapshot,
  email: string,
  ownerId?: string,
) {
  // An empty revision-zero conflict has no saved state yet.
  if (snapshot.revision === 0 && !snapshot.state.user) return;
  if (
    ownerId && snapshot.state.user?.accountId
      ? snapshot.state.user.accountId !== ownerId
      : snapshot.state.user?.email?.trim().toLowerCase() !==
        email.trim().toLowerCase()
  ) {
    throw new Error("Progress owner mismatch.");
  }
}
