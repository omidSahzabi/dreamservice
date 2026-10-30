export interface TeamMember {
  websiteUrl?: string | null;
  pr_id?: number;
  user_id?: string;
  role?: string | null;
  pr_company?: string | null;
  subdomain?: string | null;
  name?: string | null;
  imageUrl?: string | null;
  user?: {
    id?: string;
    fname?: string | null;
    lname?: string | null;
    role?: string | null;
    subdomain?: string | null;
  } | null;
  image?: {
    url?: string | null;
    altText?: string | null;
  } | null;
}

export async function fetchplus(): Promise<TeamMember[]> {
  const response = await fetch("/api/team", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Failed to load team");
  }

  const payload: unknown = await response.json();

  if (Array.isArray(payload)) return payload as TeamMember[];

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["data", "team", "members", "teamMembers"]) {
      const value = record[key];
      if (Array.isArray(value)) return value as TeamMember[];
    }
  }

  return [];
}
