import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getTarotistas, getTarotistaBySlug, getTarotistaById } from "../db";

export const tarotistasRouter = router({
  list: publicProcedure
    .input(
      z.object({
        featured: z.boolean().optional(),
        specialty: z.string().optional(),
        arcana: z.enum(["mayor", "menor", "combinada"]).optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      return getTarotistas(input ?? {});
    }),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      return getTarotistaBySlug(input.slug);
    }),

  byId: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getTarotistaById(input.id);
    }),
});
