/**
 * Minimal client for the Keyhouse API (https://github.com/KiranBabu729/keyhouse).
 * Gatekeeper's Keyhouse application runs in proxy mode: Keyhouse keeps the
 * Jira tokens and adds them to each request, so Gatekeeper never holds one.
 */

export interface KeyhouseConnection {
  id: string;
  provider: string;
  owner: { type: "user"; id: string } | { type: "organization" };
  status: "active" | "refreshing" | "needs_reauth" | "revoked" | "error";
  account: Record<string, unknown>;
  lastError: string | null;
  createdAt: string;
}

export class KeyhouseError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "KeyhouseError";
  }
}

export interface KeyhouseConfig {
  baseUrl: string;
  secretKey: string;
  /** Where Keyhouse sends people back to after connecting. */
  returnUrl: string;
}

/** Reads the Keyhouse settings from the environment, or null when they're missing. */
export function keyhouseConfig(env: NodeJS.ProcessEnv = process.env): KeyhouseConfig | null {
  const baseUrl = env.KEYHOUSE_BASE_URL?.trim();
  const secretKey = env.KEYHOUSE_SECRET_KEY?.trim();
  const appUrl = env.GATEKEEPER_BASE_URL?.trim();
  if (!baseUrl || !secretKey || !appUrl) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ""), secretKey, returnUrl: `${appUrl.replace(/\/$/, "")}/` };
}

export function keyhouseClient(cfg: KeyhouseConfig, http: typeof fetch = fetch) {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await http(`${cfg.baseUrl}/api/v1${path}`, {
        method,
        headers: { authorization: `Bearer ${cfg.secretKey}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(35_000),
      });
    } catch {
      throw new KeyhouseError(503, "keyhouse_unreachable", `Couldn't reach Keyhouse at ${cfg.baseUrl}. Check that it's running.`);
    }
    const text = await res.text();
    let data: { error?: { code?: string; message?: string } } & Record<string, unknown> = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new KeyhouseError(502, "bad_response", `Keyhouse returned an unexpected response (HTTP ${res.status}).`);
    }
    if (!res.ok) throw new KeyhouseError(res.status, data.error?.code ?? "unknown", data.error?.message ?? `Keyhouse returned HTTP ${res.status}.`);
    return data as T;
  }

  return {
    createOrgSession: (provider: string) =>
      call<{ url: string }>("POST", "/connect-sessions", { provider, owner: { type: "organization" }, returnUrl: cfg.returnUrl }),
    reconnectSession: (provider: string, connectionId: string) =>
      call<{ url: string }>("POST", "/connect-sessions", { provider, owner: { type: "organization" }, returnUrl: cfg.returnUrl, connectionId }),
    listConnections: (provider: string) =>
      call<{ data: KeyhouseConnection[] }>("GET", `/connections?provider=${encodeURIComponent(provider)}`).then((r) => r.data),
    proxy: (connectionId: string, request: { method?: string; path: string; query?: Record<string, string>; body?: unknown }) =>
      call<{ status: number; headers: Record<string, string>; body: string }>("POST", `/connections/${encodeURIComponent(connectionId)}/proxy`, {
        ...request,
        headers: { accept: "application/json" },
      }),
  };
}

export type KeyhouseClient = ReturnType<typeof keyhouseClient>;
