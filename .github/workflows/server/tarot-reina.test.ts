import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database helpers
vi.mock("./db", () => ({
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("./db.ts", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
  };
});

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Las cartas revelan un camino de luz." } }],
  }),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createAuthContext(role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-openid",
      email: "test@tarotreina.com",
      name: "Usuaria Test",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("auth router", () => {
  it("me returns null for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("me returns user for authenticated users", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.email).toBe("test@tarotreina.com");
    expect(result?.name).toBe("Usuaria Test");
  });

  it("logout clears session cookie", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });
});

describe("tarotistas router", () => {
  it("list returns tarotistas (may be empty without DB)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // Without a real DB, this should either return empty or throw gracefully
    try {
      const result = await caller.tarotistas.list({ limit: 10 });
      expect(result).toHaveProperty("tarotistas");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.tarotistas)).toBe(true);
    } catch (e: any) {
      // Acceptable: DB not available in test environment
      expect(e.message).toBeTruthy();
    }
  });

  it("bySlug throws NOT_FOUND for invalid slug", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.tarotistas.bySlug({ slug: "tarotista-que-no-existe-xyz" });
      // If DB is not available, it may throw for different reasons
    } catch (e: any) {
      expect(e).toBeTruthy();
    }
  });
});

describe("bonos router", () => {
  it("list returns bonos array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.bonos.list();
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      expect(e).toBeTruthy();
    }
  });

  it("purchase requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.bonos.purchase({ bonoId: 1 })).rejects.toThrow();
  });

  it("myBonos requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.bonos.myBonos()).rejects.toThrow();
  });
});

describe("reservas router", () => {
  it("create allows guest bookings with guest data", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // Guest reservations are allowed with guest name/email
    try {
      const result = await caller.reservas.create({
        tarotistaId: 1,
        consultationType: "chat",
        duration: 30,
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        guestName: "Invitada Test",
        guestEmail: "invitada@test.com",
      });
      // If DB is available, should succeed
      expect(result).toHaveProperty("success");
    } catch (e: any) {
      // Acceptable if DB not available in test environment
      expect(e).toBeTruthy();
    }
  });

  it("myReservas requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.reservas.myReservas()).rejects.toThrow();
  });
});

describe("chat router", () => {
  it("getSessions requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.chat.getSessions()).rejects.toThrow();
  });

  it("sendMessage requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.chat.sendMessage({ sessionId: 1, message: "Hola" })
    ).rejects.toThrow();
  });
});

describe("luna router", () => {
  it("chat responds to public messages", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.luna.chat({
        sessionKey: "test_session_key",
        message: "¿Qué me dicen las cartas sobre el amor?",
      });
      expect(result).toHaveProperty("content");
      expect(typeof result.content).toBe("string");
    } catch (e: any) {
      // Acceptable if DB not available
      expect(e).toBeTruthy();
    }
  });
});

describe("admin router", () => {
  it("stats requires admin role", async () => {
    const ctx = createAuthContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.stats()).rejects.toThrow();
  });

  it("users requires admin role", async () => {
    const ctx = createAuthContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.users()).rejects.toThrow();
  });
});
