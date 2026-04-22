export interface ProjectProfile {
  primaryLanguage: 'typescript' | 'javascript' | 'python' | 'unknown';
  framework: string | null;
  hasAuth: boolean;
  hasPayments: boolean;
  hasDatabase: boolean;
  hasTesting: boolean;
}

export interface FileSymbol {
  name: string;
  kind: 'function' | 'class' | 'variable' | 'interface' | 'other';
  startLine: number;
  endLine: number;
  children: FileSymbol[];
}

export interface AnalyzedFile {
  path: string;
  relativePath: string;
  language: string;
  lineCount: number;
  symbols: FileSymbol[];
  riskLevel: number;
  complexityScore: number;
  isAudited: boolean;
  lastAuditScore: number;
  criticalPatterns: string[];
}

export interface CriticalPath {
  file: string;
  relativePath: string;
  function: string | null;
  category: 'auth' | 'payments' | 'database' | 'error-handling' | 'api-route' | 'security';
  riskLevel: number;
  matchedPatterns: string[];
  startLine: number;
  endLine: number;
}

export interface DependencyNode {
  file: string;
  function: string;
  calledBy: string[];
  calls: string[];
  riskLevel: number;
}

export interface WorkspaceAnalysis {
  projectProfile: ProjectProfile;
  files: AnalyzedFile[];
  criticalPaths: CriticalPath[];
  dependencyGraph: DependencyNode[];
  totalFiles: number;
  totalFunctions: number;
  totalCriticalFunctions: number;
  scanTimestamp: number;
}

export interface QuizOption {
  label: string;
  text: string;
  isCorrect: boolean;
}

export interface CodeReference {
  file: string;
  startLine: number;
  endLine: number;
}

export interface QuizQuestion {
  id: string;
  question: string;
  difficulty: number;
  category: 'error-handling' | 'security' | 'data-flow' | 'edge-case' | 'architecture' | 'performance';
  codeReference: CodeReference;
  options: QuizOption[];
  explanation: string;
  dangerNote: string;
}

export interface QuizAnswer {
  questionId: string;
  selectedLabel: string;
  isCorrect: boolean;
  understandingDepth: 'surface' | 'moderate' | 'deep';
  feedback: string;
  conceptGap: string | null;
  timestamp: number;
}

export interface QuizSession {
  id: string;
  startTime: number;
  endTime?: number;
  questions: QuizQuestion[];
  answers: QuizAnswer[];
  score: number;
  totalQuestions: number;
  focusArea?: string;
  difficulty: number;
}

export interface FileScore {
  file: string;
  relativePath: string;
  score: number;
  questionCount: number;
  riskLevel: number;
  lastUpdated: number;
}

export interface DangerZone {
  file: string;
  relativePath: string;
  function: string | null;
  riskLevel: number;
  understandingScore: number;
  dangerScore: number;
  category: string;
  startLine: number;
  endLine: number;
}

export interface CategoryScore {
  category: string;
  score: number;
  questionCount: number;
}

export interface ScoreReport {
  overallScore: number;
  fileScores: FileScore[];
  dangerZones: DangerZone[];
  categoryScores: CategoryScore[];
  sessionHistory: QuizSession[];
  lastUpdated: number;
}

export interface LearningPathItem {
  file: string;
  startLine: number;
  endLine: number;
  concept: string;
  whyItMatters: string;
  priority: number;
}

export interface AnswerEvaluation {
  isCorrect: boolean;
  understandingDepth: 'surface' | 'moderate' | 'deep';
  feedback: string;
  conceptGap: string | null;
}

export interface PinnedFile {
  file: string;
  relativePath: string;
}

export interface TeamExport {
  exportedBy: string;
  exportedAt: number;
  overallScore: number;
  fileScores: FileScore[];
  categoryScores: CategoryScore[];
  sessionCount: number;
}
