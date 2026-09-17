/**
 * Password policy (shared by the API and the browser).
 *
 * One module, two consumers: the Express/Node API enforces `assertStrongPassword`
 * on every write path (register, reset, change), and the UI renders
 * `scorePassword` as a live strength meter. Keeping both sides on the same
 * rule set means the meter can never tell a user "strong" and then have the
 * server reject the same password.
 *
 * The rules target the patterns that actually get cracked: short passwords,
 * single-word passwords, `word + year` combinations, reused/breached
 * classics and keyboard walks. Length is the strongest lever, so the policy
 * rewards length aggressively.
 */

export interface PasswordPolicy {
  minLength: number;
  /** Minimum score (0–100) a password must reach to be accepted. */
  minScore: number;
}

export const PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  minScore: 60,
};

/** Most-breachable passwords. Not exhaustive — a tripwire, not a dictionary. */
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'passwort',
  '123456', '1234567', '12345678', '123456789', '1234567890', '12345678910',
  'qwerty', 'qwerty123', 'qwertyuiop', 'azerty', 'qwertz',
  'letmein', 'welcome', 'welcome1', 'admin', 'admin123', 'administrator',
  'login', 'guest', 'root', 'toor', 'master', 'monkey', 'dragon',
  'iloveyou', 'princess', 'sunshine', 'shadow', 'michael', 'jennifer',
  'football', 'baseball', 'superman', 'batman', 'trustno1', 'starwars',
  'whatever', 'freedom', 'ninja', 'solo', 'test', 'test123', 'abcd1234',
  // Project-specific terms must never anchor a password.
  'northforge',
]);

/** Words that alone (or doubled) make a password guessable. */
const WEAK_WORDS = [
  'password', 'admin', 'login', 'welcome', 'letmein', 'qwerty', 'iloveyou',
  'northforge', 'northforge2026', 'secret', 'master', 'hello', 'loveyou',
];

export type PasswordIssue = {
  code: string;
  message: string;
};

export interface PasswordScore {
  /** 0–100. >= PASSWORD_POLICY.minScore is acceptably strong. */
  score: number;
  /** 0–4 for meter rendering. */
  level: 0 | 1 | 2 | 3 | 4;
  /** Per-rule results, for the checklist UI. */
  checks: {
    length: boolean;
    upper: boolean;
    lower: boolean;
    digit: boolean;
    symbol: boolean;
    variety: boolean;
  };
  /** Human-readable reasons the password was rejected (empty when strong). */
  issues: PasswordIssue[];
  accepted: boolean;
}

function charsetSize(password: string): number {
  let size = 0;
  if (/[a-z]/.test(password)) size += 26;
  if (/[A-Z]/.test(password)) size += 26;
  if (/[0-9]/.test(password)) size += 10;
  if (/[^a-zA-Z0-9]/.test(password)) size += 33;
  return size || 1;
}

/** Rough entropy in bits — good enough to rank passwords, not crypto. */
function entropyBits(password: string): number {
  return password.length * Math.log2(charsetSize(password));
}

/**
 * Scores a password against the shared policy. Pure — no IO, no crypto,
 * safe to call on every keystroke in the UI.
 */
export function scorePassword(password: string): PasswordScore {
  const checks = {
    length: password.length >= PASSWORD_POLICY.minLength,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    symbol: /[^a-zA-Z0-9]/.test(password),
    variety: new Set(password).size >= Math.min(8, Math.max(4, Math.ceil(password.length * 0.6))),
  };

  const issues: PasswordIssue[] = [];
  const lower = password.toLowerCase();
  const compact = lower.replace(/[^a-z0-9]/g, '');

  if (password.length === 0) {
    return { score: 0, level: 0, checks, issues: [{ code: 'empty', message: 'Choose a password.' }], accepted: false };
  }

  if (!checks.length) {
    issues.push({ code: 'length', message: `Use at least ${PASSWORD_POLICY.minLength} characters.` });
  }

  if (COMMON_PASSWORDS.has(lower) || COMMON_PASSWORDS.has(compact)) {
    issues.push({ code: 'common', message: 'This password is commonly breached. Choose something unique.' });
  }

  // `word+year` — the single most common real-world weak pattern.
  const year = compact.match(/(19[6-9]\d|20[0-4]\d)$/);
  const wordPart = year ? compact.slice(0, compact.length - year[1].length) : compact;
  if (year && wordPart.length >= 4) {
    issues.push({ code: 'word_year', message: 'A word followed by a year is easy to guess. Avoid it.' });
  }

  for (const word of WEAK_WORDS) {
    if (word.length >= 4 && (lower.includes(word) || compact.includes(word))) {
      issues.push({ code: 'weak_word', message: `Avoid predictable words like "${word}".` });
      break;
    }
  }

  // Sequential runs (abcd, 1234) and key walks (qwer, asdf).
  const sequences = ['abcdefghijklmnopqrstuvwxyz', '0123456789', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  for (const seq of sequences) {
    for (let i = 0; i + 4 <= seq.length; i += 1) {
      const run = seq.slice(i, i + 4);
      if (lower.includes(run) || lower.includes([...run].reverse().join(''))) {
        issues.push({ code: 'sequence', message: 'Avoid keyboard patterns like "abcd" or "qwer".' });
        i = seq.length;
        break;
      }
    }
  }

  // Three identical characters in a row (aaa, 111).
  if (/(.)\1{2}/.test(password)) {
    issues.push({ code: 'repeat', message: 'Avoid repeating the same character three times.' });
  }

  // ── Score ──
  // Start from entropy, then penalise the structural weaknesses above so a
  // long but predictable password cannot score highly.
  let score = Math.min(100, Math.round((entropyBits(password) / 100) * 100));

  if (issues.some((issue) => issue.code === 'common')) score = Math.min(score, 15);
  if (issues.some((issue) => issue.code === 'word_year')) score = Math.min(score, 40);
  if (issues.some((issue) => issue.code === 'weak_word')) score = Math.min(score, 45);
  if (issues.some((issue) => issue.code === 'sequence')) score = Math.min(score, 45);
  if (issues.some((issue) => issue.code === 'repeat')) score = Math.min(score, 50);

  const classCount = [checks.upper, checks.lower, checks.digit, checks.symbol].filter(Boolean).length;
  if (classCount < 3) score = Math.min(score, 45);
  if (classCount === 4 && checks.length) score = Math.min(100, score + 10);
  if (password.length >= 16) score = Math.min(100, score + 5);

  score = Math.max(0, Math.min(100, score));
  const level = (score < 25 ? 0 : score < 45 ? 1 : score < 60 ? 2 : score < 80 ? 3 : 4) as PasswordScore['level'];

  const structuralOk = classCount >= 3 && checks.length && !issues.length;
  const accepted = structuralOk && score >= PASSWORD_POLICY.minScore;

  if (accepted) return { score, level, checks, issues: [], accepted: true };

  if (!issues.length) {
    if (classCount < 3) {
      issues.push({ code: 'variety', message: 'Mix uppercase, lowercase, numbers and symbols.' });
    } else {
      issues.push({ code: 'score', message: 'Choose a longer, less predictable password.' });
    }
  }

  return { score, level, checks, issues, accepted };
}

/** Throws a 400-style message when the password is weak (server side). */
export function passwordProblem(password: string): string | null {
  const result = scorePassword(password);
  if (result.accepted) return null;
  return result.issues[0]?.message ?? 'Choose a stronger password.';
}

/** Convenience for the UI checklist. */
export function passwordChecklist(password: string): { label: string; ok: boolean }[] {
  const { checks } = scorePassword(password);
  return [
    { label: `${PASSWORD_POLICY.minLength}+ characters`, ok: checks.length },
    { label: 'Upper & lowercase', ok: checks.upper && checks.lower },
    { label: 'A number', ok: checks.digit },
    { label: 'A symbol', ok: checks.symbol },
  ];
}
