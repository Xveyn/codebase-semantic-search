export interface User {
  id: string;
  email: string;
  role: "admin" | "user";
}

export interface AuthToken {
  token: string;
  userId: string;
  expiresAt: Date;
}

export function validatePassword(password: string): boolean {
  return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
}

export function hashPassword(password: string): string {
  // Simplified for testing
  return Buffer.from(password).toString("base64");
}

export async function authenticateUser(email: string, password: string): Promise<AuthToken | null> {
  // Simplified authentication logic
  if (!email || !validatePassword(password)) {
    return null;
  }

  return {
    token: `token_${Date.now()}`,
    userId: `user_${email}`,
    expiresAt: new Date(Date.now() + 3600000),
  };
}

export function isTokenExpired(token: AuthToken): boolean {
  return token.expiresAt < new Date();
}

export class AuthService {
  private tokens: Map<string, AuthToken> = new Map();

  async login(email: string, password: string): Promise<string | null> {
    const token = await authenticateUser(email, password);
    if (!token) return null;

    this.tokens.set(token.token, token);
    return token.token;
  }

  validateToken(tokenString: string): boolean {
    const token = this.tokens.get(tokenString);
    if (!token) return false;
    return !isTokenExpired(token);
  }

  logout(tokenString: string): void {
    this.tokens.delete(tokenString);
  }
}
