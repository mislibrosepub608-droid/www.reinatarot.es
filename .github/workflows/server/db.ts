import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  bonos,
  chatMessages,
  chatSessions,
  lunaMessages,
  resenas,
  reservas,
  tarotistas,
  userBonos,
  users,
  type InsertUser,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

// ─── Tarotistas ───────────────────────────────────────────────────────────────
export async function getTarotistas(opts: {
  featured?: boolean;
  specialty?: string;
  arcana?: "mayor" | "menor" | "combinada";
  search?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const db = await getDb();
  if (!db) return { tarotistas: [], total: 0 };

  const { featured, specialty, arcana, search, limit = 50, offset = 0 } = opts;
  const conditions = [];
  if (featured !== undefined) conditions.push(eq(tarotistas.featured, featured));
  if (specialty) conditions.push(eq(tarotistas.specialty, specialty));
  if (arcana) conditions.push(eq(tarotistas.arcana, arcana));
  if (search) {
    conditions.push(
      or(
        like(tarotistas.name, `%${search}%`),
        like(tarotistas.specialty, `%${search}%`),
        like(tarotistas.tagline, `%${search}%`)
      )
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, countRows] = await Promise.all([
    db.select().from(tarotistas).where(where).orderBy(desc(tarotistas.rating)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(tarotistas).where(where),
  ]);

  return { tarotistas: rows, total: Number(countRows[0]?.count ?? 0) };
}

export async function getTarotistaBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(tarotistas).where(eq(tarotistas.slug, slug)).limit(1);
  return result[0] ?? null;
}

export async function getTarotistaById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(tarotistas).where(eq(tarotistas.id, id)).limit(1);
  return result[0] ?? null;
}

export async function updateTarotista(id: number, data: Partial<typeof tarotistas.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(tarotistas).set({ ...data, updatedAt: new Date() }).where(eq(tarotistas.id, id));
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
export async function createChatSession(userId: number, tarotistaId: number, title?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(chatSessions).values({ userId, tarotistaId, title: title ?? "Nueva consulta" });
  return result[0];
}

export async function getChatSessions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatSessions).where(eq(chatSessions.userId, userId)).orderBy(desc(chatSessions.updatedAt));
}

export async function getChatMessages(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId)).orderBy(chatMessages.createdAt);
}

export async function addChatMessage(sessionId: number, role: "user" | "assistant", content: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(chatMessages).values({ sessionId, role, content });
  await db.update(chatSessions).set({ updatedAt: new Date() }).where(eq(chatSessions.id, sessionId));
}

export async function getChatSession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(chatSessions).where(eq(chatSessions.id, sessionId)).limit(1);
  return result[0] ?? null;
}

// ─── Luna Chatbot ─────────────────────────────────────────────────────────────
export async function getLunaMessages(sessionKey: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(lunaMessages).where(eq(lunaMessages.sessionKey, sessionKey)).orderBy(lunaMessages.createdAt).limit(20);
}

export async function addLunaMessage(sessionKey: string, role: "user" | "assistant", content: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(lunaMessages).values({ sessionKey, role, content });
}

// ─── Reservas ─────────────────────────────────────────────────────────────────
export async function createReserva(data: typeof reservas.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(reservas).values(data);
  return result;
}

export async function getReservasByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reservas).where(eq(reservas.userId, userId)).orderBy(desc(reservas.scheduledAt));
}

export async function getAllReservas() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reservas).orderBy(desc(reservas.scheduledAt));
}

export async function updateReservaStatus(id: number, status: "pending" | "confirmed" | "completed" | "cancelled") {
  const db = await getDb();
  if (!db) return;
  await db.update(reservas).set({ status, updatedAt: new Date() }).where(eq(reservas.id, id));
}

// ─── Reseñas ──────────────────────────────────────────────────────────────────
export async function createResena(data: typeof resenas.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(resenas).values(data);
  // Actualizar rating promedio de la tarotista
  const allResenas = await db.select({ rating: resenas.rating }).from(resenas)
    .where(and(eq(resenas.tarotistaId, data.tarotistaId!), eq(resenas.approved, true)));
  if (allResenas.length > 0) {
    const avg = allResenas.reduce((s, r) => s + r.rating, 0) / allResenas.length;
    await db.update(tarotistas).set({
      rating: avg.toFixed(2),
      reviewCount: allResenas.length,
    }).where(eq(tarotistas.id, data.tarotistaId!));
  }
}

export async function getResenasByTarotista(tarotistaId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: resenas.id,
    rating: resenas.rating,
    title: resenas.title,
    content: resenas.content,
    createdAt: resenas.createdAt,
    userName: users.name,
  }).from(resenas)
    .leftJoin(users, eq(resenas.userId, users.id))
    .where(and(eq(resenas.tarotistaId, tarotistaId), eq(resenas.approved, true)))
    .orderBy(desc(resenas.createdAt));
}

export async function getApprovedResenas(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: resenas.id,
    rating: resenas.rating,
    title: resenas.title,
    content: resenas.content,
    createdAt: resenas.createdAt,
    userName: users.name,
    tarotistaName: tarotistas.name,
  }).from(resenas)
    .leftJoin(users, eq(resenas.userId, users.id))
    .leftJoin(tarotistas, eq(resenas.tarotistaId, tarotistas.id))
    .where(eq(resenas.approved, true))
    .orderBy(desc(resenas.createdAt))
    .limit(limit);
}

export async function getAllResenas() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: resenas.id,
    rating: resenas.rating,
    title: resenas.title,
    content: resenas.content,
    approved: resenas.approved,
    createdAt: resenas.createdAt,
    userName: users.name,
    tarotistaName: tarotistas.name,
    tarotistaId: resenas.tarotistaId,
    userId: resenas.userId,
  }).from(resenas)
    .leftJoin(users, eq(resenas.userId, users.id))
    .leftJoin(tarotistas, eq(resenas.tarotistaId, tarotistas.id))
    .orderBy(desc(resenas.createdAt));
}

export async function approveResena(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(resenas).set({ approved: true }).where(eq(resenas.id, id));
}

// ─── Bonos ────────────────────────────────────────────────────────────────────
export async function getBonos() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bonos).where(eq(bonos.active, true)).orderBy(bonos.sessions);
}

export async function getAllBonos() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bonos).orderBy(bonos.sessions);
}

export async function getUserBonos(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: userBonos.id,
    sessionsTotal: userBonos.sessionsTotal,
    sessionsUsed: userBonos.sessionsUsed,
    expiresAt: userBonos.expiresAt,
    status: userBonos.status,
    createdAt: userBonos.createdAt,
    bonoName: bonos.name,
  }).from(userBonos)
    .leftJoin(bonos, eq(userBonos.bonoId, bonos.id))
    .where(and(eq(userBonos.userId, userId), eq(userBonos.status, "active")));
}

export async function createUserBono(data: typeof userBonos.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(userBonos).values(data);
}

// ─── Stats para Admin ─────────────────────────────────────────────────────────
export async function getAdminStats() {
  const db = await getDb();
  if (!db) return { users: 0, reservas: 0, resenas: 0, tarotistas: 0 };
  const [usersCount, reservasCount, resenasCount, tarotistasCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(users),
    db.select({ count: sql<number>`count(*)` }).from(reservas),
    db.select({ count: sql<number>`count(*)` }).from(resenas),
    db.select({ count: sql<number>`count(*)` }).from(tarotistas),
  ]);
  return {
    users: Number(usersCount[0]?.count ?? 0),
    reservas: Number(reservasCount[0]?.count ?? 0),
    resenas: Number(resenasCount[0]?.count ?? 0),
    tarotistas: Number(tarotistasCount[0]?.count ?? 0),
  };
}
