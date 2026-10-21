"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { synchronizeProgressState } from "@/lib/progress";
import {
  clearTrainingDatabase,
  loadTrainingDatabase,
  syncTrainingDatabase,
} from "@/services/persistence/training-database";
import { type ProjectId } from "@/lib/learning-program";
import type {
  AppState,
  CodeVersion,
  ExerciseFeedback,
  ProgrammingLanguageId,
  SavedCodeSnippet,
  TutorMessageInput,
} from "@/lib/types";
import {
  loadRemoteProgress,
  mergeProgressStates,
  saveRemoteProgress,
  type SyncIndicator,
} from "@/services/sync/progress-sync";

import {
  accountStorageKey,
  activateSessionPresentation,
  announceAuthChange,
  AUTH_CHANGE_KEY,
  clearSessionPresentation,
  ownsProgress,
  type SessionAccount,
} from "@/lib/account-storage";

import {
  applyOfficialProgress,
  type OfficialProgress,
} from "@/lib/trusted-progress";
import {
  loadOfficialProgress,
  sendOfficialAttempt,
  claimOfficialProgress,
  requestOfficialHint,
} from "@/services/sync/official-progress-client";
import type {
  Submission,
  AttemptResponse,
} from "@/services/attempts/attempt-store";
import { initialState } from "@/lib/initial-state";

type Patch = Partial<AppState> | ((state: AppState) => AppState);

type AppStateContextValue = {
  state: AppState;
  update: (patch: Patch) => void;
  saveDraft: (exerciseId: string, code: string) => void;
  recordAttempt: (
    attempt: Omit<Submission, "idempotencyKey">,
  ) => Promise<AttemptResponse>;
  requestHint: (exerciseId: string) => Promise<number>;
  recordTutorMessages: (
    exerciseId: string,
    messages: TutorMessageInput[],
  ) => void;
  toggleFavorite: (exerciseId: string) => void;
  saveNote: (exerciseId: string, note: string) => void;
  setPrimaryLanguage: (languageId: ProgrammingLanguageId) => void;
  claimWeeklyMission: () => void;
  claimProject: (projectId: ProjectId) => void;
  syncIndicator: SyncIndicator;
  recordCodeVersion: (version: Omit<CodeVersion, "id" | "createdAt">) => void;
  restoreCodeVersion: (versionId: string) => void;
  saveTutorExplanation: (input: {
    messageId: string;
    sourceId: string;
    title: string;
    content: string;
    concept?: string;
  }) => void;
  saveCodeSnippet: (input: Omit<SavedCodeSnippet, "id" | "createdAt">) => void;
  removeSavedItem: (
    kind: "explanation" | "code" | "feedback",
    id: string,
  ) => void;
  submitExerciseFeedback: (
    feedback: Omit<ExerciseFeedback, "id" | "status" | "createdAt">,
  ) => void;
  resetDemo: () => void;
  endSession: () => void;
  demoMode: boolean;
  officialProgressAvailable: boolean;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

function identityFields(account: SessionAccount): Partial<AppState["user"]> {
  return {
    accountId: account.id,
    ...(account.demo ? {} : { name: account.name }),
    email: account.email,
    role: account.role === "ADMIN" ? "admin" : "student",
    plan: account.plan === "PRO" ? "pro" : "free",
    onboarded: account.onboardingCompleted ?? false,
  };
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<SessionAccount | null | undefined>(
    undefined,
  );
  const verifiedAccount = useRef<SessionAccount | null | undefined>(undefined);
  const requestVersion = useRef(0);
  const refreshIdentity = useCallback(async () => {
    const version = ++requestVersion.current;
    let next: SessionAccount | null = null;
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to verify session.");
      const payload = (await response.json()) as {
        account: SessionAccount | null;
        demo?: boolean;
      };
      next = payload.account
        ? { ...payload.account, demo: payload.demo === true }
        : null;
    } catch {
      // Never restore an identity from an unverified browser cache.
    }
    if (version !== requestVersion.current) return;
    const previous = verifiedAccount.current;
    if (previous !== undefined && previous?.id !== next?.id) {
      // Revalidate server-rendered permissions as well as client state.
      setAccount(undefined);
      clearSessionPresentation();
      window.location.reload();
      return;
    }
    verifiedAccount.current = next;
    activateSessionPresentation(next?.id ?? null);
    setAccount((current) =>
      JSON.stringify(current) === JSON.stringify(next) ? current : next,
    );
  }, []);

  useEffect(() => {
    void refreshIdentity();
    const changed = (event: StorageEvent) => {
      if (event.key === AUTH_CHANGE_KEY) {
        setAccount(undefined);
        clearSessionPresentation();
        window.location.reload();
      }
    };
    const focus = () => {
      void refreshIdentity();
    };
    window.addEventListener("storage", changed);
    window.addEventListener("focus", focus);
    return () => {
      requestVersion.current += 1;
      window.removeEventListener("storage", changed);
      window.removeEventListener("focus", focus);
    };
  }, [refreshIdentity]);

  const signOut = useCallback(() => {
    requestVersion.current += 1;
    clearSessionPresentation();
    verifiedAccount.current = null;
    setAccount(undefined);
    announceAuthChange();
  }, []);

  if (account === undefined) return null;
  return (
    <AccountStateProvider
      key={account?.id ?? "visitor"}
      account={account}
      onSignOut={signOut}
    >
      {children}
    </AccountStateProvider>
  );
}

function AccountStateProvider({
  children,
  account,
  onSignOut,
}: {
  children: React.ReactNode;
  account: SessionAccount | null;
  onSignOut: () => void;
}) {
  const storageKey = account ? accountStorageKey(account.id) : null;
  const identityState = useMemo<AppState>(
    () => ({
      ...initialState,
      user: account
        ? {
            ...initialState.user,
            accountId: account.id,
            name: account.name,
            email: account.email,
            role: account.role === "ADMIN" ? "admin" : "student",
            plan: account.plan === "PRO" ? "pro" : "free",
            onboarded: account.onboardingCompleted ?? false,
            locale: account.locale ?? "pt-BR",
            initialLanguage: account.initialLanguage ?? "javascript",
          }
        : { ...initialState.user },
    }),
    [account],
  );
  const [state, setState] = useState<AppState>(identityState);
  const [syncIndicator, setSyncIndicator] = useState<SyncIndicator>({
    status: "local",
    message: "Backup local ativo",
  });
  const officialProgress = useRef<OfficialProgress | null>(null);
  // Presentation metadata only; the official snapshot remains the authority.
  const [officialProgressAvailable, setOfficialProgressAvailable] =
    useState(false);
  const remoteRevision = useRef(0);
  const remoteReady = useRef(false);
  const syncInProgress = useRef(false);
  const syncPending = useRef(false);
  const latestState = useRef(state);

  useEffect(() => {
    latestState.current = state;
  }, [state]);

  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        if (!account || !storageKey) {
          if (!cancelled) setState({ ...identityState, hydrated: true });
          return;
        }
        let localState = { ...identityState, hydrated: true };
        try {
          // Legacy shared stores are deliberately not imported: their owner is unknown.
          const stored = window.localStorage.getItem(storageKey);
          const candidate = stored
            ? (JSON.parse(stored) as Partial<AppState>)
            : {};
          const parsed = ownsProgress(candidate, account) ? candidate : {};
          const database = await loadTrainingDatabase(account.id);
          localState = synchronizeProgressState({
            ...identityState,
            ...parsed,
            user: {
              ...identityState.user,
              ...parsed.user,
              ...identityFields(account),
            },
            attemptHistory: parsed.attemptHistory ?? database.attempts,
            tutorMessages: parsed.tutorMessages ?? database.tutorMessages,
            xpTransactions: parsed.xpTransactions ?? database.xpTransactions,
            userSkills: parsed.userSkills ?? database.userSkills,
            userLanguages: parsed.userLanguages?.length
              ? parsed.userLanguages
              : database.userLanguages.length
                ? database.userLanguages
                : identityState.userLanguages,
            rewardGrants: parsed.rewardGrants ?? database.rewardGrants,
            codeVersions: parsed.codeVersions ?? database.codeVersions,
            savedTutorExplanations:
              parsed.savedTutorExplanations ?? database.savedTutorExplanations,
            savedCodeSnippets:
              parsed.savedCodeSnippets ?? database.savedCodeSnippets,
            exerciseFeedback:
              parsed.exerciseFeedback ?? database.exerciseFeedback,
            hydrated: true,
          });
        } catch {
          // Corrupt or unavailable local storage cannot restore a different owner.
        }
        localState = applyOfficialProgress(localState, null);
        try {
          const remote = await loadRemoteProgress(account.email, account.id);
          if (cancelled) return;
          if (remote) {
            remoteRevision.current = remote.revision;
            const remoteState = {
              ...identityState,
              ...remote.state,
              user: {
                ...identityState.user,
                ...remote.state.user,
                ...identityFields(account),
              },
              hydrated: true,
            };
            localState = synchronizeProgressState(
              mergeProgressStates(localState, remoteState),
            );
            setSyncIndicator({
              status: "saved",
              message: "Progresso sincronizado",
              lastSyncedAt: remote.updatedAt,
            });
          }
        } catch {
          if (cancelled) return;
          setSyncIndicator({
            status: navigator.onLine ? "error" : "offline",
            message:
              "Não foi possível sincronizar. Dados desta conta preservados localmente.",
          });
        }
        if (!account.demo) {
          try {
            const official = await loadOfficialProgress(account.id);
            if (cancelled) return;
            officialProgress.current = official;
            setOfficialProgressAvailable(true);
          } catch {
            /* Fail closed: cached rewards never substitute for the server. */
          }
        }
        localState = applyOfficialProgress(
          localState,
          officialProgress.current,
        );
        if (!cancelled) {
          remoteReady.current = true;
          setState(localState);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      active.current = false;
      remoteReady.current = false;
      window.clearTimeout(timer);
    };
  }, [account, storageKey, identityState]);

  useEffect(() => {
    if (
      !account ||
      !ownsProgress(state, account) ||
      !state.hydrated ||
      !remoteReady.current
    )
      return;
    const timer = window.setTimeout(() => {
      if (syncInProgress.current) {
        syncPending.current = true;
        return;
      }
      if (!navigator.onLine) {
        setSyncIndicator({
          status: "offline",
          message: "Offline — alterações serão sincronizadas ao reconectar.",
        });
        return;
      }
      const synchronize = (snapshot: AppState) => {
        if (!active.current || !ownsProgress(snapshot, account)) return;
        syncInProgress.current = true;
        setSyncIndicator({ status: "saving", message: "Salvando..." });
        void saveRemoteProgress(
          snapshot.user.email,
          remoteRevision.current,
          snapshot,
          account.id,
        )
          .then((result) => {
            if (!active.current) return;
            if (result.kind === "conflict") {
              remoteRevision.current = result.snapshot.revision;
              const remoteState = {
                ...identityState,
                ...result.snapshot.state,
                user: {
                  ...identityState.user,
                  ...result.snapshot.state.user,
                  ...identityFields(account),
                },
                hydrated: true,
              };
              setState((current) =>
                synchronizeProgressState(
                  mergeProgressStates(current, remoteState),
                ),
              );
              setSyncIndicator({
                status: "conflict",
                message: "Conflito preservado no histórico de versões.",
              });
            } else {
              remoteRevision.current = result.snapshot.revision;
              setSyncIndicator({
                status: "saved",
                message: "Salvo",
                lastSyncedAt: result.snapshot.updatedAt,
              });
            }
          })
          .catch(
            () =>
              active.current &&
              setSyncIndicator({
                status: navigator.onLine ? "error" : "offline",
                message: navigator.onLine
                  ? "Não foi possível sincronizar. Tentaremos novamente."
                  : "Offline — alterações serão sincronizadas ao reconectar.",
              }),
          )
          .finally(() => {
            syncInProgress.current = false;
            if (active.current && syncPending.current) {
              syncPending.current = false;
              synchronize(latestState.current);
            }
          });
      };
      synchronize(state);
    }, 850);
    return () => window.clearTimeout(timer);
  }, [state, account, identityState]);

  useLayoutEffect(() => {
    if (!state.hydrated) return;
    if (storageKey && account && ownsProgress(state, account)) {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ ...state, hydrated: undefined }),
      );
    }
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.dataset.interfaceSize = state.interfaceSize;
    document.documentElement.dataset.reducedMotion = String(
      state.reducedMotion,
    );
    document.documentElement.lang = state.user.locale ?? "pt-BR";
  }, [state, storageKey, account]);

  useEffect(() => {
    if (!account || !state.hydrated || state.user.accountId !== account.id)
      return;
    void syncTrainingDatabase(account.id, {
      attempts: state.attemptHistory,
      tutorMessages: state.tutorMessages,
      xpTransactions: state.xpTransactions,
      userSkills: state.userSkills,
      userLanguages: state.userLanguages,
      rewardGrants: state.rewardGrants,
      codeVersions: state.codeVersions,
      savedTutorExplanations: state.savedTutorExplanations,
      savedCodeSnippets: state.savedCodeSnippets,
      exerciseFeedback: state.exerciseFeedback,
    }).catch(() => undefined);
  }, [
    account,
    state.user.accountId,
    state.attemptHistory,
    state.hydrated,
    state.rewardGrants,
    state.codeVersions,
    state.savedTutorExplanations,
    state.savedCodeSnippets,
    state.exerciseFeedback,
    state.tutorMessages,
    state.userLanguages,
    state.userSkills,
    state.xpTransactions,
  ]);

  const update = useCallback((patch: Patch) => {
    setState((current) => {
      const next =
        typeof patch === "function" ? patch(current) : { ...current, ...patch };
      return applyOfficialProgress(next, officialProgress.current);
    });
  }, []);

  const saveDraft = useCallback((exerciseId: string, code: string) => {
    setState((current) => ({
      ...current,
      drafts: { ...current.drafts, [exerciseId]: code },
    }));
  }, []);

  const acceptOfficial = useCallback(
    (official: OfficialProgress) => {
      if (!active.current || !account || official.ownerId !== account.id)
        return;
      if (
        officialProgress.current &&
        official.revision < officialProgress.current.revision
      )
        return;
      officialProgress.current = official;
      setOfficialProgressAvailable(true);
      setState((current) => applyOfficialProgress(current, official));
    },
    [account],
  );

  useEffect(() => {
    if (!account || account.demo) return;
    const refresh = () => {
      void loadOfficialProgress(account.id)
        .then(acceptOfficial)
        .catch(() => undefined);
    };
    const changed = (event: StorageEvent) => {
      if (event.key === "logiclab-progress-changed:" + account.id) refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("storage", changed);
    };
  }, [account, acceptOfficial]);

  const recordAttempt = useCallback(
    async (attempt: Omit<Submission, "idempotencyKey">) => {
      if (!account || account.demo)
        throw new Error(
          "Entre em uma conta real para registrar progresso oficial.",
        );
      const storage =
        "logiclab-attempt-pending:" +
        encodeURIComponent(account.id) +
        ":" +
        encodeURIComponent(attempt.exerciseId);
      const body = JSON.stringify(attempt);
      let idempotencyKey = crypto.randomUUID();
      try {
        const pending = JSON.parse(localStorage.getItem(storage) ?? "null") as {
          body?: string;
          key?: string;
        } | null;
        if (pending?.body === body && pending.key)
          idempotencyKey = pending.key as typeof idempotencyKey;
        localStorage.setItem(
          storage,
          JSON.stringify({ body, key: idempotencyKey }),
        );
      } catch {
        /* Server uniqueness still prevents double completion rewards. */
      }
      const result = await sendOfficialAttempt(account.id, {
        ...attempt,
        idempotencyKey,
      });
      if (!active.current)
        throw new Error("A sessão foi alterada durante o envio.");
      acceptOfficial(result.official);
      try {
        const pending = JSON.parse(localStorage.getItem(storage) ?? "null") as {
          key?: string;
        } | null;
        if (pending?.key === idempotencyKey) localStorage.removeItem(storage);
      } catch {
        /* An unconfirmed request keeps its key; a future intent gets a new one after confirmation. */
      }
      try {
        localStorage.setItem(
          "logiclab-progress-changed:" + account.id,
          crypto.randomUUID(),
        );
      } catch {
        /* Focus also refreshes. */
      }
      return result;
    },
    [account, acceptOfficial],
  );

  const requestHint = useCallback(
    async (exerciseId: string) => {
      if (!account || account.demo)
        throw new Error("Entre em uma conta real para registrar dicas.");
      const result = await requestOfficialHint(account.id, exerciseId);
      acceptOfficial(result.official);
      return result.hintCount;
    },
    [account, acceptOfficial],
  );

  const recordTutorMessages = useCallback(
    (exerciseId: string, messages: TutorMessageInput[]) => {
      const now = Date.now();
      setState((current) => ({
        ...current,
        tutorMessages: {
          ...current.tutorMessages,
          [exerciseId]: [
            ...(current.tutorMessages[exerciseId] ?? []),
            ...messages.map((message, index) => ({
              ...message,
              id:
                globalThis.crypto?.randomUUID?.() ??
                `${exerciseId}-tutor-${now}-${index}`,
              exerciseId,
              createdAt: new Date(now + index).toISOString(),
            })),
          ],
        },
      }));
    },
    [],
  );

  const toggleFavorite = useCallback((exerciseId: string) => {
    setState((current) => ({
      ...current,
      favorites: current.favorites.includes(exerciseId)
        ? current.favorites.filter((id) => id !== exerciseId)
        : [...current.favorites, exerciseId],
    }));
  }, []);

  const saveNote = useCallback(
    (exerciseId: string, note: string) => {
      setState((current) => {
        const next = {
          ...current,
          notes: { ...current.notes, [exerciseId]: note },
        };
        if (next.hydrated && storageKey)
          window.localStorage.setItem(
            storageKey,
            JSON.stringify({ ...next, hydrated: undefined }),
          );
        return next;
      });
    },
    [storageKey],
  );

  const setPrimaryLanguage = useCallback(
    (languageId: ProgrammingLanguageId) => {
      setState((current) => {
        if (
          !current.userLanguages.some(
            (language) => language.languageId === languageId,
          )
        )
          return current;
        return synchronizeProgressState({
          ...current,
          primaryLanguage: languageId,
        });
      });
    },
    [],
  );

  const claimReward = useCallback(
    (projectId?: string) => {
      if (!account || account.demo) return;
      void claimOfficialProgress(account.id, projectId)
        .then((official) => {
          acceptOfficial(official);
          try {
            localStorage.setItem(
              "logiclab-progress-changed:" + account.id,
              crypto.randomUUID(),
            );
          } catch {
            /* Optional notification. */
          }
        })
        .catch(() => {
          if (active.current)
            setSyncIndicator({
              status: "error",
              message:
                "A recompensa não foi confirmada pelo servidor. Tente novamente.",
            });
        });
    },
    [account, acceptOfficial],
  );
  const claimWeeklyMission = useCallback(() => claimReward(), [claimReward]);
  const claimProject = useCallback(
    (projectId: ProjectId) => claimReward(projectId),
    [claimReward],
  );

  const recordCodeVersion = useCallback(
    (version: Omit<CodeVersion, "id" | "createdAt">) => {
      setState((current) => {
        const latest = current.codeVersions
          .filter((item) => item.sourceId === version.sourceId)
          .at(-1);
        if (
          latest?.code === version.code &&
          version.reason !== "complete" &&
          version.reason !== "conflict"
        )
          return current;
        return {
          ...current,
          codeVersions: [
            ...current.codeVersions,
            {
              ...version,
              id: globalThis.crypto?.randomUUID?.() ?? `version-${Date.now()}`,
              createdAt: new Date().toISOString(),
            },
          ].slice(-250),
        };
      });
    },
    [],
  );

  const restoreCodeVersion = useCallback((versionId: string) => {
    setState((current) => {
      const version = current.codeVersions.find(
        (item) => item.id === versionId,
      );
      if (!version) return current;
      const currentCode = current.drafts[version.sourceId];
      const preserved: CodeVersion[] = currentCode
        ? [
            {
              id: globalThis.crypto?.randomUUID?.() ?? `version-${Date.now()}`,
              scope: version.scope,
              sourceId: version.sourceId,
              language: version.language,
              code: currentCode,
              reason: "restore",
              createdAt: new Date().toISOString(),
            },
          ]
        : [];
      return {
        ...current,
        drafts: { ...current.drafts, [version.sourceId]: version.code },
        codeVersions: [...current.codeVersions, ...preserved],
      };
    });
  }, []);

  const saveTutorExplanation = useCallback(
    (input: {
      messageId: string;
      sourceId: string;
      title: string;
      content: string;
      concept?: string;
    }) => {
      setState((current) => {
        if (
          current.savedTutorExplanations.some(
            (item) => item.messageId === input.messageId,
          )
        )
          return current;
        return {
          ...current,
          savedTutorExplanations: [
            ...current.savedTutorExplanations,
            {
              ...input,
              id:
                globalThis.crypto?.randomUUID?.() ??
                `explanation-${Date.now()}`,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      });
    },
    [],
  );

  const saveCodeSnippet = useCallback(
    (input: Omit<SavedCodeSnippet, "id" | "createdAt">) => {
      setState((current) => ({
        ...current,
        savedCodeSnippets: [
          ...current.savedCodeSnippets,
          {
            ...input,
            id: globalThis.crypto?.randomUUID?.() ?? `snippet-${Date.now()}`,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    },
    [],
  );

  const removeSavedItem = useCallback(
    (kind: "explanation" | "code" | "feedback", id: string) => {
      setState((current) => ({
        ...current,
        savedTutorExplanations:
          kind === "explanation"
            ? current.savedTutorExplanations.filter((item) => item.id !== id)
            : current.savedTutorExplanations,
        savedCodeSnippets:
          kind === "code"
            ? current.savedCodeSnippets.filter((item) => item.id !== id)
            : current.savedCodeSnippets,
        exerciseFeedback:
          kind === "feedback"
            ? current.exerciseFeedback.filter((item) => item.id !== id)
            : current.exerciseFeedback,
      }));
    },
    [],
  );

  const submitExerciseFeedback = useCallback(
    (feedback: Omit<ExerciseFeedback, "id" | "status" | "createdAt">) => {
      setState((current) => ({
        ...current,
        exerciseFeedback: [
          ...current.exerciseFeedback,
          {
            ...feedback,
            id: globalThis.crypto?.randomUUID?.() ?? `feedback-${Date.now()}`,
            status: "new",
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    },
    [],
  );

  const resetDemo = useCallback(() => {
    if (!account?.demo) return;
    void clearTrainingDatabase(account.id).then(() => {
      if (active.current)
        setState(
          synchronizeProgressState({ ...identityState, hydrated: true }),
        );
    });
  }, [account, identityState]);

  const value = useMemo(
    () => ({
      state,
      update,
      saveDraft,
      recordAttempt,
      requestHint,
      recordTutorMessages,
      toggleFavorite,
      saveNote,
      setPrimaryLanguage,
      claimWeeklyMission,
      claimProject,
      syncIndicator,
      recordCodeVersion,
      restoreCodeVersion,
      saveTutorExplanation,
      saveCodeSnippet,
      removeSavedItem,
      submitExerciseFeedback,
      resetDemo,
      endSession: onSignOut,
      demoMode: account?.demo === true,
      officialProgressAvailable,
    }),
    [
      state,
      update,
      saveDraft,
      recordAttempt,
      requestHint,
      recordTutorMessages,
      toggleFavorite,
      saveNote,
      setPrimaryLanguage,
      claimWeeklyMission,
      claimProject,
      syncIndicator,
      recordCodeVersion,
      restoreCodeVersion,
      saveTutorExplanation,
      saveCodeSnippet,
      removeSavedItem,
      submitExerciseFeedback,
      resetDemo,
      onSignOut,
      account,
      officialProgressAvailable,
    ],
  );

  return (
    <AppStateContext.Provider value={value}>
      {state.hydrated ? children : null}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context)
    throw new Error("useAppState must be used inside AppStateProvider");
  return context;
}
