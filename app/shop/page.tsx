import PageShell from "@/components/PageShell";
import ShopView from "@/components/shop/ShopView";

export const metadata = { title: "Shop — VELUNE", description: "The VELUNE collection of whole-plant skincare." };

export default function ShopPage() {
  return (
    <PageShell>
      <ShopView />
    </PageShell>
  );
}
