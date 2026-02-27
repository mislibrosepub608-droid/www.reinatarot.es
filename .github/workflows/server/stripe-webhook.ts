import Stripe from "stripe";
import type { Express, Request, Response } from "express";
import express from "express";
import { createUserBono, getAllBonos } from "./db";

export const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

const stripe = stripeClient;

export function registerStripeWebhook(app: Express) {
  // MUST use raw body parser BEFORE express.json() for signature verification
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: any) {
        console.error("[Stripe Webhook] Signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      console.log(`[Stripe Webhook] Event: ${event.type} | ID: ${event.id}`);

      // Handle test events
      if (event.id.startsWith("evt_test_")) {
        console.log("[Stripe Webhook] Test event detected, returning verification response");
        return res.json({ verified: true });
      }

      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = parseInt(session.metadata?.user_id ?? "0");
            const bonoId = parseInt(session.metadata?.bono_id ?? "0");

            if (userId && bonoId) {
              const allBonos = await getAllBonos();
              const bono = allBonos.find((b) => b.id === bonoId);

              if (bono) {
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + (bono.validDays ?? 365));

                await createUserBono({
                  userId,
                  bonoId: bono.id,
                  sessionsTotal: bono.sessions,
                  expiresAt,
                  stripePaymentId: session.id,
                });

                console.log(`[Stripe Webhook] Bono ${bonoId} activated for user ${userId}`);
              }
            }
            break;
          }

          case "payment_intent.succeeded":
            console.log(`[Stripe Webhook] Payment succeeded: ${(event.data.object as Stripe.PaymentIntent).id}`);
            break;

          case "payment_intent.payment_failed":
            console.log(`[Stripe Webhook] Payment failed: ${(event.data.object as Stripe.PaymentIntent).id}`);
            break;

          default:
            console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }
      } catch (err) {
        console.error("[Stripe Webhook] Error processing event:", err);
        return res.status(500).json({ error: "Webhook processing failed" });
      }

      res.json({ received: true });
    }
  );
}
