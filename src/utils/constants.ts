export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const HTTP_REFERER = 'https://github.com/CodeLitmus';
export const APP_TITLE = 'codelitmus';

export const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py']);

export const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.next', '__pycache__',
  'venv', '.git', 'out', '.vscode-test', 'coverage', '.nyc_output',
]);

export const AUTH_PATTERNS = [
  'auth', 'login', 'signup', 'register', 'password', 'token', 'jwt',
  'session', 'oauth', 'middleware', 'verify', 'hash', 'bcrypt', 'passport',
];

export const PAYMENT_PATTERNS = [
  'payment', 'stripe', 'razorpay', 'checkout', 'billing', 'subscription',
  'invoice', 'charge', 'refund', 'webhook',
];

export const DB_PATTERNS = [
  'create', 'update', 'delete', 'remove', 'destroy', 'insert', 'mutation',
  'migrate', 'prisma', 'mongoose', 'sequelize', 'sql', 'query',
];

export const ERROR_PATTERNS = ['try', 'catch', 'throw', 'error', 'reject', 'finally'];

export const ROUTE_PATTERNS = [
  'routes/', 'api/', 'controllers/', 'endpoints/',
  '@app.route', 'router.get', 'router.post', 'router.put', 'router.delete',
  'app.get', 'app.post', 'app.put', 'app.delete',
];

export const SECURITY_PATTERNS = [
  'cors', 'helmet', 'csrf', 'sanitize', 'validate', 'encrypt', 'decrypt', 'secret', 'env',
];

export const MAX_LINES_PER_LLM_CALL = 2000;
export const MAX_FILES_DEFAULT = 1000;
export const PRIORITY_DIRS = ['src', 'app', 'pages', 'lib', 'api'];

export const DEFAULT_MODEL = 'deepseek/deepseek-chat-v3-0324:free';
export const LLM_TIMEOUT_MS = 30000;
export const LLM_RETRY_DELAYS = [1000, 3000];
