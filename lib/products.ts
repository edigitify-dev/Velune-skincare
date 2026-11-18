// Real VELUNE catalogue — names, sizes and claims are taken from the packaging.
// Prices were not on the packaging: fill in `price` for each product (left undefined = hidden).
export type Product = {
  id: string;
  name: string;
  tagline: string;
  size: string;
  price?: number;
  desc: string;
  image: string;
  bg: string;
};

export const PRODUCTS: Product[] = [
  {
    id: "cleanse",
    name: "Velvet Cleanse",
    tagline: "Gentle face cleanser",
    size: "150 ml",
    image: "/collection/cleanse.webp",
    bg: "#F5F0E9",
    desc: "Gentle face cleanser for soft, balanced skin. With aloe, green tea & panthenol.",
  },
  {
    id: "mist",
    name: "Rosewater Mist",
    tagline: "Hydrating face mist",
    size: "100 ml",
    image: "/collection/mist.webp",
    bg: "#F3DAD3",
    desc: "Hydrating face mist that refreshes, soothes and balances. With pure rose water.",
  },
  {
    id: "serum",
    name: "Dewdrop Hydrating Serum",
    tagline: "Hyaluronic acid + botanical extracts",
    size: "30 ml",
    image: "/collection/serum.webp",
    bg: "#EFE3D6",
    desc: "A hydrating serum with hyaluronic acid and botanical extracts.",
  },
  {
    id: "oil",
    name: "Botanical Glow Oil",
    tagline: "Radiance + nourishment face oil",
    size: "30 ml",
    image: "/collection/oil.webp",
    bg: "#F1E2BC",
    desc: "A radiance and nourishment face oil with rosehip, jojoba & squalane.",
  },
  {
    id: "veil",
    name: "Daily Veil",
    tagline: "SPF 50 PA++++ broad spectrum sunscreen",
    size: "50 ml",
    image: "/collection/veil.webp",
    bg: "#E9D4C2",
    desc: "Broad spectrum SPF 50 PA++++ sunscreen with UVA/UVB protection. Lightweight, non-greasy and hydrating, with niacinamide, hyaluronic acid & centella.",
  },
  {
    id: "wash",
    name: "Silken Body Wash",
    tagline: "Nourishing body cleanser",
    size: "300 ml",
    image: "/collection/wash.webp",
    bg: "#F2D5CB",
    desc: "Nourishing body cleanser that cleanses gently, hydrates and softens. With aloe, oat extract & vitamin E.",
  },
  {
    id: "lotion",
    name: "Nourishing Body Lotion",
    tagline: "Deep hydration",
    size: "300 ml",
    image: "/collection/lotion.webp",
    bg: "#DCC5B0",
    desc: "Deep hydration for soft, supple skin.",
  },
];
