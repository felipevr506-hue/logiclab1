import type {
  AttemptRecord,
  CodeVersion,
  ExerciseFeedback,
  RewardGrant,
  SavedCodeSnippet,
  SavedTutorExplanation,
  TutorMessage,
  UserLanguage,
  UserSkillProgress,
  XPTransaction,
} from "@/lib/types";

import { trainingDatabaseName } from "@/lib/account-storage";
const DATABASE_VERSION = 3;
const ATTEMPTS_STORE = "attempts";
const MESSAGES_STORE = "tutorMessages";
const XP_STORE = "xpTransactions";
const SKILLS_STORE = "userSkills";
const LANGUAGES_STORE = "userLanguages";
const REWARDS_STORE = "rewardGrants";
const CODE_VERSIONS_STORE = "codeVersions";
const EXPLANATIONS_STORE = "savedTutorExplanations";
const SNIPPETS_STORE = "savedCodeSnippets";
const FEEDBACK_STORE = "exerciseFeedback";

type TrainingDatabaseSnapshot = {
  attempts: AttemptRecord[];
  tutorMessages: Record<string, TutorMessage[]>;
  xpTransactions: XPTransaction[];
  userSkills: Record<string, UserSkillProgress>;
  userLanguages: UserLanguage[];
  rewardGrants: RewardGrant[];
  codeVersions: CodeVersion[];
  savedTutorExplanations: SavedTutorExplanation[];
  savedCodeSnippets: SavedCodeSnippet[];
  exerciseFeedback: ExerciseFeedback[];
};

export type TrainingDatabaseInput = TrainingDatabaseSnapshot;

function openTrainingDatabase(accountId: string): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window))
    return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(
      trainingDatabaseName(accountId),
      DATABASE_VERSION,
    );
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ATTEMPTS_STORE)) {
        const attempts = database.createObjectStore(ATTEMPTS_STORE, {
          keyPath: "id",
        });
        attempts.createIndex("exerciseId", "exerciseId");
        attempts.createIndex("createdAt", "createdAt");
      }
      if (!database.objectStoreNames.contains(MESSAGES_STORE)) {
        const messages = database.createObjectStore(MESSAGES_STORE, {
          keyPath: "id",
        });
        messages.createIndex("exerciseId", "exerciseId");
        messages.createIndex("createdAt", "createdAt");
      }
      if (!database.objectStoreNames.contains(XP_STORE)) {
        const xpTransactions = database.createObjectStore(XP_STORE, {
          keyPath: "id",
        });
        xpTransactions.createIndex("uniqueKey", "uniqueKey", { unique: true });
        xpTransactions.createIndex("createdAt", "createdAt");
      }
      if (!database.objectStoreNames.contains(SKILLS_STORE)) {
        database.createObjectStore(SKILLS_STORE, { keyPath: "skillId" });
      }
      if (!database.objectStoreNames.contains(LANGUAGES_STORE)) {
        database.createObjectStore(LANGUAGES_STORE, { keyPath: "languageId" });
      }
      if (!database.objectStoreNames.contains(REWARDS_STORE)) {
        const rewards = database.createObjectStore(REWARDS_STORE, {
          keyPath: "id",
        });
        rewards.createIndex("rewardId", "rewardId", { unique: true });
      }
      if (!database.objectStoreNames.contains(CODE_VERSIONS_STORE)) {
        const versions = database.createObjectStore(CODE_VERSIONS_STORE, {
          keyPath: "id",
        });
        versions.createIndex("sourceId", "sourceId");
        versions.createIndex("createdAt", "createdAt");
      }
      if (!database.objectStoreNames.contains(EXPLANATIONS_STORE)) {
        database.createObjectStore(EXPLANATIONS_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(SNIPPETS_STORE)) {
        database.createObjectStore(SNIPPETS_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(FEEDBACK_STORE)) {
        const feedback = database.createObjectStore(FEEDBACK_STORE, {
          keyPath: "id",
        });
        feedback.createIndex("exerciseId", "exerciseId");
        feedback.createIndex("status", "status");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadTrainingDatabase(
  accountId: string,
): Promise<TrainingDatabaseSnapshot> {
  const database = await openTrainingDatabase(accountId);
  if (!database)
    return {
      attempts: [],
      tutorMessages: {},
      xpTransactions: [],
      userSkills: {},
      userLanguages: [],
      rewardGrants: [],
      codeVersions: [],
      savedTutorExplanations: [],
      savedCodeSnippets: [],
      exerciseFeedback: [],
    };
  try {
    const transaction = database.transaction(
      [
        ATTEMPTS_STORE,
        MESSAGES_STORE,
        XP_STORE,
        SKILLS_STORE,
        LANGUAGES_STORE,
        REWARDS_STORE,
        CODE_VERSIONS_STORE,
        EXPLANATIONS_STORE,
        SNIPPETS_STORE,
        FEEDBACK_STORE,
      ],
      "readonly",
    );
    const [
      attempts,
      messages,
      xpTransactions,
      skills,
      userLanguages,
      rewardGrants,
      codeVersions,
      savedTutorExplanations,
      savedCodeSnippets,
      exerciseFeedback,
    ] = await Promise.all([
      requestResult(
        transaction.objectStore(ATTEMPTS_STORE).getAll() as IDBRequest<
          AttemptRecord[]
        >,
      ),
      requestResult(
        transaction.objectStore(MESSAGES_STORE).getAll() as IDBRequest<
          TutorMessage[]
        >,
      ),
      requestResult(
        transaction.objectStore(XP_STORE).getAll() as IDBRequest<
          XPTransaction[]
        >,
      ),
      requestResult(
        transaction.objectStore(SKILLS_STORE).getAll() as IDBRequest<
          UserSkillProgress[]
        >,
      ),
      requestResult(
        transaction.objectStore(LANGUAGES_STORE).getAll() as IDBRequest<
          UserLanguage[]
        >,
      ),
      requestResult(
        transaction.objectStore(REWARDS_STORE).getAll() as IDBRequest<
          RewardGrant[]
        >,
      ),
      requestResult(
        transaction.objectStore(CODE_VERSIONS_STORE).getAll() as IDBRequest<
          CodeVersion[]
        >,
      ),
      requestResult(
        transaction.objectStore(EXPLANATIONS_STORE).getAll() as IDBRequest<
          SavedTutorExplanation[]
        >,
      ),
      requestResult(
        transaction.objectStore(SNIPPETS_STORE).getAll() as IDBRequest<
          SavedCodeSnippet[]
        >,
      ),
      requestResult(
        transaction.objectStore(FEEDBACK_STORE).getAll() as IDBRequest<
          ExerciseFeedback[]
        >,
      ),
    ]);
    const tutorMessages = messages.reduce<Record<string, TutorMessage[]>>(
      (grouped, message) => {
        grouped[message.exerciseId] = [
          ...(grouped[message.exerciseId] ?? []),
          message,
        ];
        return grouped;
      },
      {},
    );
    return {
      attempts: attempts.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      tutorMessages,
      xpTransactions: xpTransactions.sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      ),
      userSkills: skills.reduce<Record<string, UserSkillProgress>>(
        (grouped, skill) => ({ ...grouped, [skill.skillId]: skill }),
        {},
      ),
      userLanguages,
      rewardGrants,
      codeVersions: codeVersions.sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
      savedTutorExplanations,
      savedCodeSnippets,
      exerciseFeedback,
    };
  } finally {
    database.close();
  }
}

export async function syncTrainingDatabase(
  accountId: string,
  input: TrainingDatabaseInput,
) {
  const database = await openTrainingDatabase(accountId);
  if (!database) return;
  try {
    const transaction = database.transaction(
      [
        ATTEMPTS_STORE,
        MESSAGES_STORE,
        XP_STORE,
        SKILLS_STORE,
        LANGUAGES_STORE,
        REWARDS_STORE,
        CODE_VERSIONS_STORE,
        EXPLANATIONS_STORE,
        SNIPPETS_STORE,
        FEEDBACK_STORE,
      ],
      "readwrite",
    );
    const attemptsStore = transaction.objectStore(ATTEMPTS_STORE);
    const messagesStore = transaction.objectStore(MESSAGES_STORE);
    const xpStore = transaction.objectStore(XP_STORE);
    const skillsStore = transaction.objectStore(SKILLS_STORE);
    const languagesStore = transaction.objectStore(LANGUAGES_STORE);
    const rewardsStore = transaction.objectStore(REWARDS_STORE);
    const versionsStore = transaction.objectStore(CODE_VERSIONS_STORE);
    const explanationsStore = transaction.objectStore(EXPLANATIONS_STORE);
    const snippetsStore = transaction.objectStore(SNIPPETS_STORE);
    const feedbackStore = transaction.objectStore(FEEDBACK_STORE);
    input.attempts.forEach((attempt) => attemptsStore.put(attempt));
    Object.values(input.tutorMessages)
      .flat()
      .forEach((message) => messagesStore.put(message));
    input.xpTransactions.forEach((xpTransaction) => xpStore.put(xpTransaction));
    Object.values(input.userSkills).forEach((skill) => skillsStore.put(skill));
    input.userLanguages.forEach((language) => languagesStore.put(language));
    input.rewardGrants.forEach((reward) => rewardsStore.put(reward));
    input.codeVersions.forEach((version) => versionsStore.put(version));
    input.savedTutorExplanations.forEach((explanation) =>
      explanationsStore.put(explanation),
    );
    input.savedCodeSnippets.forEach((snippet) => snippetsStore.put(snippet));
    input.exerciseFeedback.forEach((feedback) => feedbackStore.put(feedback));
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function clearTrainingDatabase(accountId: string) {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  await new Promise<void>((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase(
      trainingDatabaseName(accountId),
    );
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}
