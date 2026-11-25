"use client";
import { CartProvider } from "@/lib/cart";
import SmoothScroll from "@/components/SmoothScroll";
import Nav from "@/components/Nav";
import CartDrawer from "@/components/CartDrawer";
import Footer from "@/components/Footer";

export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <SmoothScroll />
      <Nav />
      <CartDrawer />
      <main className="page-in">{children}</main>
      <Footer />
    </CartProvider>
  );
}
