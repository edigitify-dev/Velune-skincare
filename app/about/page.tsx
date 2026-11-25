import PageShell from "@/components/PageShell";
import AboutView from "@/components/about/AboutView";

export const metadata = { title: "About — VELUNE", description: "Whole-plant luxury skincare. A slower, more intentional approach to care." };

export default function AboutPage() {
  return (
    <PageShell>
      <AboutView />
    </PageShell>
  );
}
