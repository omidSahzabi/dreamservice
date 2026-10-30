import {pageMetadata} from "@/lib/i18n/metadata";
export function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  return pageMetadata(params, "about", "/about");
}




import AboutHero from "@/components/templates/about/AboutHero";
import TeamSection from "@/components/templates/about/TeamSection";
import AboutValues from "@/components/templates/about/AboutValues";
import {connection} from "next/server";
import {unstable_rethrow} from "next/navigation";
import {getPublishedTeam} from "@/lib/team/service";
import {securityEvent} from "@/lib/security/http";
import type {TeamMember} from "@/lib/api/team";

export default async function AboutPage() {
  await connection();
  let team: TeamMember[] | undefined;
  try {
    team = await getPublishedTeam();
  } catch (error) {
    unstable_rethrow(error);
    securityEvent("operation_failed");
    // Retain the localized client retry/error flow when server loading fails.
  }

  return (
    <main
      className="min-h-screen overflow-hidden bg-background text-foreground"
    >
      <AboutHero />
      <TeamSection initialTeam={team} />
      <AboutValues />
    </main>
  );
}
