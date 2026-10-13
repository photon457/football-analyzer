/**
 * Manager Authentication Service
 * Manages local session persistence, account registration, credentials verification,
 * and pre-configured test manager account in localStorage / sessionStorage.
 */

export interface ManagerUser {
  id: string;
  name: string;
  email: string;
  club: string;
  role: string;
  tacticalPhilosophy?: string;
  preferredShape?: string;
  seasonObjective?: string;
}

export interface StoredAccount extends ManagerUser {
  passwordHash: string; // Plaintext or base64 encoded for desktop local storage
  createdAt: string;
}

export interface AuthSession {
  user: ManagerUser;
  token: string;
  loginTime: string;
  rememberMe: boolean;
}

const STORAGE_KEY_ACCOUNTS = 'football_analyzer_accounts';
const STORAGE_KEY_SESSION = 'football_analyzer_session';
const STORAGE_KEY_REMEMBER = 'football_analyzer_remember_me';

export const DEFAULT_TEST_ACCOUNT: StoredAccount = {
  id: 'mgr_default_test',
  name: 'The Manager',
  email: 'manager@tactical.fc',
  passwordHash: 'password123',
  club: 'Chelsea',
  role: 'Head Coach & Performance Analyst',
  tacticalPhilosophy: 'Positional play & transition control',
  preferredShape: '4-3-3 Holding (fluid build-up)',
  seasonObjective: 'Contend for Premier League Title & UCL Qualification',
  createdAt: '2024-01-01T00:00:00.000Z',
};

/**
 * Initializes and retrieves stored accounts from localStorage.
 * Guarantees default test manager account is always available.
 */
export function getStoredAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
    if (!raw) {
      const initial = [DEFAULT_TEST_ACCOUNT];
      localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(initial));
      return initial;
    }
    const parsed: StoredAccount[] = JSON.parse(raw);
    // Ensure default test account is present
    if (!parsed.some((acc) => acc.email.toLowerCase() === DEFAULT_TEST_ACCOUNT.email.toLowerCase())) {
      parsed.unshift(DEFAULT_TEST_ACCOUNT);
      localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return [DEFAULT_TEST_ACCOUNT];
  }
}

function saveAccounts(accounts: StoredAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
  } catch {
    // Graceful fallback
  }
}

/**
 * Retrieves the currently active manager session, if any.
 */
export function getStoredSession(): AuthSession | null {
  try {
    // First check localStorage (Remember Me)
    const localRaw = localStorage.getItem(STORAGE_KEY_SESSION);
    if (localRaw) {
      return JSON.parse(localRaw);
    }
    // Then check sessionStorage
    const sessionRaw = sessionStorage.getItem(STORAGE_KEY_SESSION);
    if (sessionRaw) {
      return JSON.parse(sessionRaw);
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Authenticates manager credentials.
 */
export function loginManager(
  email: string,
  password: string,
  rememberMe: boolean = true
): { success: boolean; user?: ManagerUser; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();

  if (!cleanEmail || !cleanPassword) {
    return { success: false, error: 'Please enter both manager email and password.' };
  }

  const accounts = getStoredAccounts();
  const account = accounts.find((a) => a.email.toLowerCase() === cleanEmail);

  if (!account) {
    return { success: false, error: 'No manager account found with this email address.' };
  }

  if (account.passwordHash !== cleanPassword) {
    return { success: false, error: 'Incorrect credentials. Please verify your password.' };
  }

  const user: ManagerUser = {
    id: account.id,
    name: account.name,
    email: account.email,
    club: account.club,
    role: account.role,
    tacticalPhilosophy: account.tacticalPhilosophy,
    preferredShape: account.preferredShape,
    seasonObjective: account.seasonObjective,
  };

  const session: AuthSession = {
    user,
    token: `token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    loginTime: new Date().toISOString(),
    rememberMe,
  };

  try {
    const serialized = JSON.stringify(session);
    if (rememberMe) {
      localStorage.setItem(STORAGE_KEY_SESSION, serialized);
      localStorage.setItem(STORAGE_KEY_REMEMBER, 'true');
    } else {
      sessionStorage.setItem(STORAGE_KEY_SESSION, serialized);
      localStorage.removeItem(STORAGE_KEY_SESSION);
      localStorage.setItem(STORAGE_KEY_REMEMBER, 'false');
    }
  } catch {
    // local storage fallback
  }

  return { success: true, user };
}

/**
 * Registers a new manager account.
 */
export function registerManager(payload: {
  name: string;
  email: string;
  password: string;
  club: string;
  role?: string;
  tacticalPhilosophy?: string;
  preferredShape?: string;
  seasonObjective?: string;
}): { success: boolean; user?: ManagerUser; error?: string } {
  const cleanName = payload.name.trim();
  const cleanEmail = payload.email.trim().toLowerCase();
  const cleanPassword = payload.password.trim();
  const cleanClub = payload.club.trim() || 'Chelsea';

  if (!cleanName) {
    return { success: false, error: 'Manager full name is required.' };
  }
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Please provide a valid manager email address.' };
  }
  if (!cleanPassword || cleanPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  const accounts = getStoredAccounts();
  if (accounts.some((a) => a.email.toLowerCase() === cleanEmail)) {
    return { success: false, error: 'An account with this email address is already registered.' };
  }

  const newAccount: StoredAccount = {
    id: `mgr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: cleanName,
    email: cleanEmail,
    passwordHash: cleanPassword,
    club: cleanClub,
    role: payload.role?.trim() || 'Head Coach & Performance Analyst',
    tacticalPhilosophy: payload.tacticalPhilosophy || 'Positional play & transition control',
    preferredShape: payload.preferredShape || '4-3-3 Holding (fluid build-up)',
    seasonObjective: payload.seasonObjective || 'Top 4 & UEFA Champions League Qualification',
    createdAt: new Date().toISOString(),
  };

  accounts.push(newAccount);
  saveAccounts(accounts);

  // Auto-login registered manager
  return loginManager(cleanEmail, cleanPassword, true);
}

/**
 * Logs out active manager and clears session cache.
 */
export function logoutManager(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_SESSION);
    sessionStorage.removeItem(STORAGE_KEY_SESSION);
  } catch {
    // Ignore
  }
}

/**
 * Updates manager club and profile in active session and accounts store.
 */
export function updateCurrentUserClub(club: string): ManagerUser | null {
  const session = getStoredSession();
  if (!session) return null;

  session.user.club = club;
  const accounts = getStoredAccounts();
  const accIndex = accounts.findIndex((a) => a.id === session.user.id);
  if (accIndex !== -1) {
    accounts[accIndex].club = club;
    saveAccounts(accounts);
  }

  try {
    const serialized = JSON.stringify(session);
    if (session.rememberMe) {
      localStorage.setItem(STORAGE_KEY_SESSION, serialized);
    } else {
      sessionStorage.setItem(STORAGE_KEY_SESSION, serialized);
    }
  } catch {
    // Ignore
  }

  return session.user;
}
