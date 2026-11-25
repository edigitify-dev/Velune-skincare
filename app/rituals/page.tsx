import PageShell from "@/components/PageShell";
import RitualsView from "@/components/rituals/RitualsView";

export const metadata = { title: "Rituals — VELUNE", description: "Morning, evening and body rituals, step by step." };

export default function RitualsPage() {
  return (
    <PageShell>
      <RitualsView />
    </PageShell>
  );
}
