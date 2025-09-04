export type UserRole = "user" | "admin";

export type User = {
  username: string;
  role: UserRole;
};

const MOCK_CREDENTIALS = {
  "user123": { password: "pass123", role: "user" as UserRole },
  "admin123": { password: "pass123", role: "admin" as UserRole }
};

export function login(username: string, password: string): User | null {
  const user = MOCK_CREDENTIALS[username as keyof typeof MOCK_CREDENTIALS];
  if (user && user.password === password) {
    return { username, role: user.role };
  }
  return null;
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("currentUser");
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User | null) {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem("currentUser", JSON.stringify(user));
  } else {
    localStorage.removeItem("currentUser");
  }
}

export function logout() {
  setCurrentUser(null);
}
