import "server-only";
import { prisma } from "@/lib/prisma";
import { projectQuery } from "@/lib/projects/diagnostics";

export type PublicHomepageProject = { title: string; description: string | null; deadlineAt: string };

export async function getHomepageProject(locale: string, now: Date): Promise<PublicHomepageProject | null> {
  const project = await projectQuery("homepage", () => prisma.project.findFirst({
    where: { isPublic: true, status: { in: ["PLANNED", "ACTIVE"] }, deadlineAt: { gt: now } },
    orderBy: [{ deadlineAt: "asc" }, { id: "asc" }],
    // Explicit allowlist: no IDs, order relation, customer data or internal fields.
    select: { title: true, titleFa: true, description: true, descriptionFa: true, deadlineAt: true },
  }));
  if (!project?.deadlineAt) return null;
  return { title: locale === "fa" ? project.titleFa : project.title,
    description: locale === "fa" ? project.descriptionFa : project.description,
    deadlineAt: project.deadlineAt.toISOString() };
}
