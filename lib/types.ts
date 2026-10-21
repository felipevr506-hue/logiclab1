export type Difficulty = "Fácil" | "Médio" | "Desafio";

export type ProgrammingLanguageId =
  | "javascript"
  | "python"
  | "java"
  | "c"
  | "cpp";

export type ExerciseTest = {
  id: string;
  label: string;
  expression?: string;
  expected?: unknown;
  expectedLogs?: string[];
  feedback: string;
};

export type Exercise = {
  id: string;
  title: string;
  concept: string;
  difficulty: Difficulty;
  minutes: number;
  xp: number;
  objective: string;
  instructions: string[];
  starterCode: string;
  solution: string;
  explanation: string;
  hints: string[];
  tests: ExerciseTest[];
  language?: ProgrammingLanguageId;
  exerciseType?: "standard" | "debugging";
  runExample?: {
    label: string;
    help: string;
    defaultValue: string;
    inputKind: "number" | "text" | "json";
    expression: string;
  };
};

export type AttemptTestSnapshot = {
  id: string;
  label: string;
  passed: boolean;
  expected?: unknown;
  received?: unknown;
  feedback: string;
};

export type AttemptRecord = {
  id: string;
  exerciseId: string;
  code: string;
  createdAt: string;
  passed: boolean;
  passedTests: number;
  failedTests: number;
  testResults: AttemptTestSnapshot[];
  runtimeError?: {
    kind: "syntax" | "runtime" | "timeout";
    message: string;
    line?: number;
  };
  hintsUsed: number;
  tutorMessageIds: string[];
  attemptNumber: number;
  durationMs?: number;
  activityMode?: "path" | "practice" | "project" | "assessment";
  projectId?: string;
  assessmentId?: string;
};

export type AttemptInput = Omit<
  AttemptRecord,
  "id" | "createdAt" | "attemptNumber"
>;

export type TutorMessage = {
  id: string;
  exerciseId: string;
  role: "student" | "tutor";
  content: string;
  createdAt: string;
  helpLevel?: 1 | 2 | 3 | 4 | 5;
  errorKind?: "syntax" | "logic" | "runtime" | "output";
};

export type TutorMessageInput = Omit<
  TutorMessage,
  "id" | "exerciseId" | "createdAt"
>;

export type XPReason =
  | "exercise_completion"
  | "review"
  | "daily_challenge"
  | "workout_completion"
  | "no_hint"
  | "project_completion"
  | "weekly_mission"
  | "achievement"
  | "migration";

export type XPTransaction = {
  id: string;
  amount: number;
  reason: XPReason;
  uniqueKey: string;
  exerciseId?: string;
  workoutId?: string;
  challengeId?: string;
  projectId?: string;
  missionId?: string;
  description: string;
  createdAt: string;
};

export type RewardGrant = {
  id: string;
  rewardId: string;
  level: number;
  type: "badge" | "theme" | "language" | "tokens" | "challenge" | "project";
  title: string;
  amount?: number;
  grantedAt: string;
};

export type UserLanguage = {
  languageId: ProgrammingLanguageId;
  unlockedAt: string;
  unlockedBy: "initial" | "level" | "requirements" | "plan";
  progressPercent: number;
};

export type SkillEvidence = {
  id: string;
  exerciseId: string;
  passed: boolean;
  difficulty: "easy" | "medium" | "hard" | "expert";
  masteryAfter: number;
  createdAt: string;
};

export type UserSkillProgress = {
  skillId: string;
  masteryScore: number;
  attempts: number;
  correctAttempts: number;
  hintsUsed: number;
  lastPracticedAt?: string;
  evidence: SkillEvidence[];
};

export type XPAwardSummary = {
  amount: number;
  transactionIds: string[];
  previousLevel: number;
  currentLevel: number;
  levelsGained: number[];
  rewards: RewardGrant[];
  languagesUnlocked: ProgrammingLanguageId[];
  duplicate: boolean;
  createdAt: string;
};

export type CodeVersion = {
  id: string;
  scope: "exercise" | "playground" | "project";
  sourceId: string;
  language: ProgrammingLanguageId;
  code: string;
  reason:
    | "run"
    | "submit"
    | "complete"
    | "manual"
    | "restore"
    | "import"
    | "conflict";
  createdAt: string;
};

export type SavedTutorExplanation = {
  id: string;
  messageId: string;
  sourceId: string;
  title: string;
  content: string;
  concept?: string;
  createdAt: string;
};

export type SavedCodeSnippet = {
  id: string;
  sourceId: string;
  title: string;
  language: ProgrammingLanguageId;
  code: string;
  createdAt: string;
};

export type ExerciseFeedback = {
  id: string;
  exerciseId: string;
  sentiment?: "too-easy" | "good" | "confusing" | "problem";
  reportReason?:
    | "unclear-statement"
    | "incorrect-test"
    | "incorrect-solution"
    | "technical"
    | "translation"
    | "other";
  comment?: string;
  status: "new" | "reviewing" | "resolved" | "ignored";
  createdAt: string;
};

export type FeatureFlagKey =
  | "AI_TUTOR"
  | "PLAYGROUND"
  | "DAILY_CHALLENGE"
  | "WEEKLY_MISSIONS"
  | "PYTHON_TRACK"
  | "JAVA_TRACK"
  | "C_TRACK"
  | "CPP_TRACK"
  | "PORTFOLIO"
  | "INTERVIEW_MODE";

export type NotificationPreferences = {
  dailyTraining: boolean;
  reviews: boolean;
  achievements: boolean;
  weeklyGoal: boolean;
  importantUpdates: boolean;
};

export type AppState = {
  hydrated: boolean;
  user: {
    accountId?: string;
    name: string;
    email: string;
    avatar: string;
    goal: string;
    dailyMinutes: number;
    studyDaysPerWeek?: number;
    studyFocus?: string;
    experience: string;
    onboarded: boolean;
    locale?: "pt-BR" | "en";
    initialLanguage?: ProgrammingLanguageId;
    plan: "free" | "pro";
    role?: "student" | "admin";
    trainingStartedOn?: string;
  };
  xp: number;
  streak: number;
  longestStreak: number;
  completedExercises: string[];
  attempts: Record<string, number>;
  attemptHistory: AttemptRecord[];
  hintsUsed: Record<string, number>;
  tutorMessages: Record<string, TutorMessage[]>;
  drafts: Record<string, string>;
  favorites: string[];
  notes: Record<string, string>;
  activeDays: string[];
  theme: "dark" | "light";
  interfaceSize: "compact" | "standard" | "large";
  editorFontSize: number;
  level: number;
  xpTransactions: XPTransaction[];
  rewardGrants: RewardGrant[];
  userLanguages: UserLanguage[];
  primaryLanguage: ProgrammingLanguageId;
  userSkills: Record<string, UserSkillProgress>;
  helpTokens: number;
  codeVersions: CodeVersion[];
  savedTutorExplanations: SavedTutorExplanation[];
  savedCodeSnippets: SavedCodeSnippet[];
  favoriteProjects: string[];
  favoriteConcepts: string[];
  exerciseFeedback: ExerciseFeedback[];
  reducedMotion: boolean;
  notificationPreferences: NotificationPreferences;
  notificationsReadAt?: string;
  featureFlags: Record<FeatureFlagKey, boolean>;
  editorOnboarded: boolean;
  tutorOnboarded: boolean;
  progressionOnboarded: boolean;
  lastXpAward?: XPAwardSummary;
};
