/**
 * Stripe Products & Prices for Tarot Reina Bonos
 * Prices are in cents (EUR)
 */
export const STRIPE_PRODUCTS = [
  {
    bonoId: 1,
    name: "Bono Iniciación",
    description: "1 consulta de tarot · Válido 30 días",
    priceInCents: 1500, // 15€
  },
  {
    bonoId: 2,
    name: "Bono Esencial",
    description: "3 consultas de tarot · Válido 60 días",
    priceInCents: 3900, // 39€
  },
  {
    bonoId: 3,
    name: "Bono Místico",
    description: "5 consultas de tarot · Válido 90 días",
    priceInCents: 5900, // 59€
  },
  {
    bonoId: 4,
    name: "Bono Sabiduría",
    description: "10 consultas de tarot · Válido 180 días",
    priceInCents: 9900, // 99€
  },
  {
    bonoId: 5,
    name: "Bono Ancestral",
    description: "20 consultas de tarot · Válido 365 días",
    priceInCents: 17900, // 179€
  },
  {
    bonoId: 6,
    name: "Bono Reina",
    description: "Consultas ilimitadas · Válido 365 días",
    priceInCents: 29900, // 299€
  },
];

export function getStripeProductByBonoId(bonoId: number) {
  return STRIPE_PRODUCTS.find((p) => p.bonoId === bonoId);
}
