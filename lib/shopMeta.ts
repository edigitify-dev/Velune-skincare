// Extra shop metadata. Ingredients are taken from the text printed on each pack (see products.ts descriptions).
export type Cat = "Face" | "Body";
export const META: Record<string, { cat: Cat; step: string; notes: string[] }> = {
  cleanse: { cat: "Face", step: "Cleanse", notes: ["Aloe", "Green tea", "Panthenol"] },
  mist: { cat: "Face", step: "Refresh", notes: ["Pure rose water"] },
  serum: { cat: "Face", step: "Hydrate", notes: ["Hyaluronic acid", "Botanical extracts"] },
  oil: { cat: "Face", step: "Nourish", notes: ["Rosehip", "Jojoba", "Squalane"] },
  veil: { cat: "Face", step: "Protect", notes: ["Niacinamide", "Hyaluronic acid", "Centella"] },
  wash: { cat: "Body", step: "Cleanse", notes: ["Aloe", "Oat extract", "Vitamin E"] },
  lotion: { cat: "Body", step: "Soften", notes: ["Deep hydration"] },
};
