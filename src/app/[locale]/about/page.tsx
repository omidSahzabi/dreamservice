import {pageMetadata} from "@/lib/i18n/metadata";
export function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  return pageMetadata(params, "about", "/about");
}




import AboutHero from "@/components/templates/about/AboutHero";
import TeamSection from "@/components/templates/about/TeamSection";
import AboutValues from "@/components/templates/about/AboutValues";

export default function AboutPage() {

  return (
    <main
      className="min-h-screen overflow-hidden bg-background text-foreground"
    >
      <AboutHero />
      <TeamSection />
      <AboutValues />
    </main>
  );
}
