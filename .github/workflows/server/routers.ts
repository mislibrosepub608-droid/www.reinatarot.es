import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import {
  getTarotistas, getTarotistaBySlug, getTarotistaById, updateTarotista,
  createChatSession, getChatSessions, getChatMessages, addChatMessage, getChatSession,
  getLunaMessages, addLunaMessage,
  createReserva, getReservasByUser, getAllReservas, updateReservaStatus,
  createResena, getResenasByTarotista, getApprovedResenas, getAllResenas, approveResena,
  getBonos, getAllBonos, getUserBonos, createUserBono, getAllBonos as getAdminBonos,
  getAdminStats, getAllUsers,
} from "./db";
import { stripeClient } from "./stripe-webhook";
import { getStripeProductByBonoId } from "./stripe-products";

// ─── Tarotistas Router ────────────────────────────────────────────────────────
const tarotistasRouter = router({
  list: publicProcedure
    .input(z.object({
      featured: z.boolean().optional(),
      specialty: z.string().optional(),
      arcana: z.enum(["mayor", "menor", "combinada"]).optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => getTarotistas(input ?? {})),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => getTarotistaBySlug(input.slug)),

  byId: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => getTarotistaById(input.id)),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      available: z.boolean().optional(),
      featured: z.boolean().optional(),
      pricePerSession: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { id, ...data } = input;
      await updateTarotista(id, data);
      return { success: true };
    }),
});

// ─── Chat Router ──────────────────────────────────────────────────────────────
const chatRouter = router({
  createSession: protectedProcedure
    .input(z.object({ tarotistaId: z.number(), title: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await createChatSession(ctx.user.id, input.tarotistaId, input.title);
      return { success: true };
    }),

  getSessions: protectedProcedure
    .query(async ({ ctx }) => getChatSessions(ctx.user.id)),

  getMessages: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      const session = await getChatSession(input.sessionId);
      if (!session || session.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return getChatMessages(input.sessionId);
    }),

  sendMessage: protectedProcedure
    .input(z.object({ sessionId: z.number(), message: z.string().min(1).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const session = await getChatSession(input.sessionId);
      if (!session || session.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const tarotista = await getTarotistaById(session.tarotistaId);
      if (!tarotista) throw new TRPCError({ code: "NOT_FOUND" });

      // Save user message
      await addChatMessage(input.sessionId, "user", input.message);

      // Get conversation history
      const history = await getChatMessages(input.sessionId);
      const messages = [
        {
          role: "system" as const,
          content: tarotista.systemPrompt ?? `Eres ${tarotista.name}, una tarotista especializada en ${tarotista.specialty}. Ofreces lecturas de tarot profundas y empáticas. Responde siempre en español con sabiduría mística.`,
        },
        ...history.slice(-10).map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content) })),
      ];

      const response = await invokeLLM({ messages });
      const rawAssistant = response.choices[0]?.message?.content;
      const assistantContent = typeof rawAssistant === "string" ? rawAssistant : "Las cartas guardan silencio en este momento. Por favor, intenta de nuevo.";

      await addChatMessage(input.sessionId, "assistant", assistantContent);
      return { content: assistantContent };
    }),

  quickConsult: protectedProcedure
    .input(z.object({ tarotistaId: z.number(), question: z.string().min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const tarotista = await getTarotistaById(input.tarotistaId);
      if (!tarotista) throw new TRPCError({ code: "NOT_FOUND" });

      // Create session
      await createChatSession(ctx.user.id, input.tarotistaId, input.question.substring(0, 50));
      const sessions = await getChatSessions(ctx.user.id);
      const session = sessions[0];
      if (!session) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await addChatMessage(session.id, "user", input.question);

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: tarotista.systemPrompt ?? `Eres ${tarotista.name}, una tarotista especializada en ${tarotista.specialty}. Ofreces lecturas de tarot profundas y empáticas.`,
          },
          { role: "user", content: input.question },
        ],
      });
      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === "string" ? rawContent : "Las cartas guardan silencio en este momento.";
      await addChatMessage(session.id, "assistant", content);
      return { sessionId: session.id, content };
    }),
});

// ─── Luna Chatbot Router ──────────────────────────────────────────────────────
const lunaRouter = router({
  chat: publicProcedure
    .input(z.object({ sessionKey: z.string(), message: z.string().min(1).max(500) }))
    .mutation(async ({ input }) => {
      const history = await getLunaMessages(input.sessionKey);
      await addLunaMessage(input.sessionKey, "user", input.message);

      const messages = [
        {
          role: "system" as const,
          content: `Eres Luna, la asistente virtual mística de Tarot Reina. Eres amable, misteriosa y sabia. Tu misión es ayudar a los usuarios a encontrar la tarotista perfecta para su consulta y guiarlos por la plataforma. Hablas con un toque poético y místico. Conoces a las 45 tarotistas de Tarot Reina y puedes recomendar la más adecuada según las necesidades del usuario. Siempre terminas con una frase inspiradora. Responde en español, de forma concisa (máximo 3 párrafos).`,
        },
        ...history.slice(-6).map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content) })),
        { role: "user" as const, content: input.message },
      ];

      const response = await invokeLLM({ messages });
      const rawContent2 = response.choices[0]?.message?.content;
      const content = typeof rawContent2 === "string" ? rawContent2 : "Las estrellas me susurran que vuelvas a intentarlo pronto, querida alma.";
      await addLunaMessage(input.sessionKey, "assistant", content);
      return { content };
    }),
});

// ─── Reservas Router ──────────────────────────────────────────────────────────
const reservasRouter = router({
  create: publicProcedure
    .input(z.object({
      tarotistaId: z.number(),
      guestName: z.string().optional(),
      guestEmail: z.string().email().optional(),
      guestPhone: z.string().optional(),
      scheduledAt: z.string(),
      duration: z.number().default(30),
      consultationType: z.enum(["chat", "video", "phone"]).default("chat"),
      question: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tarotista = await getTarotistaById(input.tarotistaId);
      if (!tarotista) throw new TRPCError({ code: "NOT_FOUND" });

      await createReserva({
        userId: ctx.user?.id,
        tarotistaId: input.tarotistaId,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        guestPhone: input.guestPhone,
        scheduledAt: new Date(input.scheduledAt),
        duration: input.duration,
        consultationType: input.consultationType,
        question: input.question,
        price: tarotista.pricePerSession,
      });

      // Notificar al propietario
      await notifyOwner({
        title: "Nueva Reserva en Tarot Reina",
        content: `Nueva reserva con ${tarotista.name} para ${new Date(input.scheduledAt).toLocaleString("es-ES")}. Cliente: ${input.guestName ?? ctx.user?.name ?? "Usuario registrado"}`,
      });

      return { success: true };
    }),

  myReservas: protectedProcedure
    .query(async ({ ctx }) => getReservasByUser(ctx.user.id)),

  all: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return getAllReservas();
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["pending", "confirmed", "completed", "cancelled"]) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await updateReservaStatus(input.id, input.status);
      return { success: true };
    }),
});

// ─── Reseñas Router ───────────────────────────────────────────────────────────
const resenasRouter = router({
  create: protectedProcedure
    .input(z.object({
      tarotistaId: z.number(),
      rating: z.number().min(1).max(5),
      title: z.string().optional(),
      content: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await createResena({ ...input, userId: ctx.user.id });
      return { success: true };
    }),

  byTarotista: publicProcedure
    .input(z.object({ tarotistaId: z.number() }))
    .query(async ({ input }) => getResenasByTarotista(input.tarotistaId)),

  listApproved: publicProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ input }) => getApprovedResenas(input.limit)),

  all: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return getAllResenas();
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await approveResena(input.id);
      return { success: true };
    }),
});

// ─── Bonos Router ─────────────────────────────────────────────────────────────
const bonosRouter = router({
  list: publicProcedure
    .query(async () => getBonos()),

  allAdmin: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return getAllBonos();
    }),

  myBonos: protectedProcedure
    .query(async ({ ctx }) => getUserBonos(ctx.user.id)),

  purchase: protectedProcedure
    .input(z.object({ bonoId: z.number(), origin: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const allBonos = await getAllBonos();
      const bono = allBonos.find((b) => b.id === input.bonoId);
      if (!bono) throw new TRPCError({ code: "NOT_FOUND" });

      const product = getStripeProductByBonoId(bono.id);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Producto de Stripe no encontrado" });

      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: product.name,
                description: product.description,
              },
              unit_amount: product.priceInCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        allow_promotion_codes: true,
        customer_email: ctx.user.email ?? undefined,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          bono_id: bono.id.toString(),
          customer_email: ctx.user.email ?? "",
          customer_name: ctx.user.name ?? "",
        },
        success_url: `${input.origin}/bonos?success=true&bono=${bono.id}`,
        cancel_url: `${input.origin}/bonos?cancelled=true`,
      });

      return { checkoutUrl: session.url };
    }),
});

// ─── Admin Router ─────────────────────────────────────────────────────────────
const adminRouter = router({
  stats: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return getAdminStats();
    }),

  users: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return getAllUsers();
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  tarotistas: tarotistasRouter,
  chat: chatRouter,
  luna: lunaRouter,
  reservas: reservasRouter,
  resenas: resenasRouter,
  bonos: bonosRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
