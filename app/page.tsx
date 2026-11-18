import { CartProvider } from "@/lib/cart";
import SmoothScroll from "@/components/SmoothScroll";
import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import CartDrawer from "@/components/CartDrawer";
import Hero from "@/components/Hero";
import ScrollVideo from "@/components/ScrollVideo";
import Bloom from "@/components/Bloom";
import MolecularExperience from "@/components/MolecularExperience";
import Products from "@/components/Products";
import FinalRitual from "@/components/FinalRitual";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <CartProvider>
      <SmoothScroll />
      <Loader />
      <Nav />
      <CartDrawer />
      <main>
        <Hero />
        <MolecularExperience />
        <ScrollVideo />
        {/* <Bloom /> */}
        <Products />
        <FinalRitual />
      </main>
      <Footer />
    </CartProvider>
  );
}
