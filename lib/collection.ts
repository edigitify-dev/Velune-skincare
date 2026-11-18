/**
 * VELUNE collection used by the molecular experience.
 * - Names come from the creative brief.
 * - `category`, `line` and `size` are taken from the text printed on each real pack shot.
 * - `image` points at transparent cut-outs of the supplied studio assets (originals are untouched).
 * - NO prices: none exist in the project yet. Add `price` here when verified and wire it to the cart.
 */
export type CollectionItem = {
  id: string;
  name: string;
  category: string;
  line: string; // tagline as printed on the pack
  size: string; // as printed on the pack
  image: string;
  h: number; // product height as a fraction of its studio frame, keeps real proportions in the carousel
  tint: string; // soft background tone while this product is in focus (palette-derived)
  price?: number;
};

export const COLLECTION: CollectionItem[] = [
  {
    id: "lotion",
    name: "Nourishing Body Lotion",
    category: "Body",
    line: "Deep hydration · soft, supple skin",
    size: "300 ml",
    image: "/collection/lotion.webp",
    h: 0.777,
    tint: "#E9D4C2",
  },
  {
    id: "serum",
    name: "Dewdrop Hydrating Serum",
    category: "Face serum",
    line: "Hyaluronic acid + botanical extracts",
    size: "30 ml",
    image: "/collection/serum.webp",
    h: 0.921,
    tint: "#EBD6C3",
  },
  {
    id: "cleanse",
    name: "Velvet Cleanse",
    category: "Face cleanser",
    line: "Gentle face cleanser for soft, balanced skin",
    size: "150 ml",
    image: "/collection/cleanse.webp",
    h: 0.83,
    tint: "#E6CFBB",
  },
  {
    id: "oil",
    name: "Botanical Glow Oil",
    category: "Face oil",
    line: "Radiance + nourishment face oil",
    size: "30 ml",
    image: "/collection/oil.webp",
    h: 0.807,
    tint: "#E3C6A6",
  },
  {
    id: "veil",
    name: "Daily Veil SPF 50",
    category: "Sunscreen",
    line: "Broad spectrum sunscreen",
    size: "50 ml",
    image: "/collection/veil.webp",
    h: 0.848,
    tint: "#E8D2BD",
  },
  {
    id: "mist",
    name: "Rosewater Mist",
    category: "Face mist",
    line: "Hydrating face mist",
    size: "100 ml",
    image: "/collection/mist.webp",
    h: 0.89,
    tint: "#EBD0C4",
  },
  {
    id: "wash",
    name: "Silken Body Wash",
    category: "Body cleanser",
    line: "Nourishing body cleanser",
    size: "300 ml",
    image: "/collection/wash.webp",
    h: 0.883,
    tint: "#E8CBBD",
  },
];

/** Placeholder ingredient names from the brief. `role` is a generic ingredient class, not a VELUNE formulation claim. */
export type Ingredient = { name: string; role: string; icon: string };
export const INGREDIENTS: Ingredient[] = [
  {
    name: "Hyaluronic Acid",
    role: "Humectant",
    icon: "/ingredients/hyaluronic.webp",
  },
  {
    name: "Niacinamide",
    role: "Vitamin B3",
    icon: "/ingredients/niacinamide.webp",
  },
  {
    name: "Vitamin C",
    role: "Antioxidant",
    icon: "/ingredients/vitamin_c.webp",
  },
  {
    name: "Ceramides",
    role: "Skin lipid",
    icon: "/ingredients/ceramides.webp",
  },
  { name: "Squalane", role: "Emollient", icon: "/ingredients/squalane.webp" },
  {
    name: "Peptides",
    role: "Amino-acid chains",
    icon: "/ingredients/peptides.webp",
  },
  { name: "Aloe Vera", role: "Botanical", icon: "/ingredients/aloeVera.webp" },
  {
    name: "Centella Asiatica",
    role: "Botanical",
    icon: "/ingredients/centella.webp",
  },
  {
    name: "Panthenol",
    role: "Provitamin B5",
    icon: "/ingredients/panthenol.webp",
  },
  {
    name: "Vitamin E",
    role: "Antioxidant",
    icon: "/ingredients/vitamin_e.webp",
  },
  {
    name: "Green Tea Extract",
    role: "Botanical",
    icon: "/ingredients/greenTea.webp",
  },
  { name: "Rose Extract", role: "Botanical", icon: "/ingredients/rose.webp" },
  { name: "Jojoba Oil", role: "Plant oil", icon: "/ingredients/jojoba.webp" },
  { name: "Glycerin", role: "Humectant", icon: "/ingredients/glycerin.webp" },
  {
    name: "Botanical Extracts",
    role: "Whole-plant",
    icon: "/ingredients/botanicalExtracts.webp",
  },
];
