import {
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  phone: varchar("phone", { length: 32 }),
  avatar: text("avatar"),
  bio: text("bio"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Tarotistas ───────────────────────────────────────────────────────────────
export const tarotistas = mysqlTable("tarotistas", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  tagline: varchar("tagline", { length: 256 }),
  bio: text("bio"),
  specialty: varchar("specialty", { length: 128 }),
  specialties: text("specialties"), // JSON array
  experience: int("experience").default(1), // años de experiencia
  rating: decimal("rating", { precision: 3, scale: 2 }).default("5.00"),
  reviewCount: int("reviewCount").default(0),
  pricePerSession: decimal("pricePerSession", { precision: 8, scale: 2 }).default("25.00"),
  available: boolean("available").default(true),
  featured: boolean("featured").default(false),
  arcana: mysqlEnum("arcana", ["mayor", "menor", "combinada"]).default("combinada"),
  style: varchar("style", { length: 128 }), // estilo de lectura
  languages: varchar("languages", { length: 128 }).default("Español"),
  responseTime: varchar("responseTime", { length: 64 }).default("Inmediata"),
  totalConsultations: int("totalConsultations").default(0),
  imageUrl: text("imageUrl"), // URL de la foto de la tarotista
  systemPrompt: text("systemPrompt"), // prompt IA personalizado
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tarotista = typeof tarotistas.$inferSelect;
export type InsertTarotista = typeof tarotistas.$inferInsert;

// ─── Chat Sessions ────────────────────────────────────────────────────────────
export const chatSessions = mysqlTable("chat_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tarotistaId: int("tarotistaId").notNull(),
  title: varchar("title", { length: 256 }),
  status: mysqlEnum("status", ["active", "closed"]).default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChatSession = typeof chatSessions.$inferSelect;

// ─── Chat Messages ────────────────────────────────────────────────────────────
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;

// ─── Reservas ─────────────────────────────────────────────────────────────────
export const reservas = mysqlTable("reservas", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  tarotistaId: int("tarotistaId").notNull(),
  guestName: varchar("guestName", { length: 128 }),
  guestEmail: varchar("guestEmail", { length: 320 }),
  guestPhone: varchar("guestPhone", { length: 32 }),
  scheduledAt: timestamp("scheduledAt").notNull(),
  duration: int("duration").default(30), // minutos
  consultationType: mysqlEnum("consultationType", ["chat", "video", "phone"]).default("chat"),
  question: text("question"),
  status: mysqlEnum("status", ["pending", "confirmed", "completed", "cancelled"]).default("pending"),
  notes: text("notes"),
  price: decimal("price", { precision: 8, scale: 2 }),
  bonoId: int("bonoId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Reserva = typeof reservas.$inferSelect;

// ─── Reseñas ──────────────────────────────────────────────────────────────────
export const resenas = mysqlTable("resenas", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tarotistaId: int("tarotistaId").notNull(),
  rating: int("rating").notNull(), // 1-5
  title: varchar("title", { length: 256 }),
  content: text("content"),
  approved: boolean("approved").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Resena = typeof resenas.$inferSelect;

// ─── Bonos / Paquetes ─────────────────────────────────────────────────────────
export const bonos = mysqlTable("bonos", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  sessions: int("sessions").notNull(), // número de consultas incluidas
  price: decimal("price", { precision: 8, scale: 2 }).notNull(),
  originalPrice: decimal("originalPrice", { precision: 8, scale: 2 }),
  validDays: int("validDays").default(365),
  active: boolean("active").default(true),
  featured: boolean("featured").default(false),
  stripePriceId: varchar("stripePriceId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Bono = typeof bonos.$inferSelect;

// ─── User Bonos (bonos comprados por usuarios) ────────────────────────────────
export const userBonos = mysqlTable("user_bonos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  bonoId: int("bonoId").notNull(),
  sessionsTotal: int("sessionsTotal").notNull(),
  sessionsUsed: int("sessionsUsed").default(0),
  expiresAt: timestamp("expiresAt"),
  stripePaymentId: varchar("stripePaymentId", { length: 256 }),
  status: mysqlEnum("status", ["active", "expired", "exhausted"]).default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserBono = typeof userBonos.$inferSelect;

// ─── Luna Chatbot Messages ────────────────────────────────────────────────────
export const lunaMessages = mysqlTable("luna_messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionKey: varchar("sessionKey", { length: 128 }).notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LunaMessage = typeof lunaMessages.$inferSelect;
