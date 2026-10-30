import "server-only";
import {prisma} from "@/lib/prisma";
import {publicTeamImageUrl} from "@/lib/team/image-url";
import {teamWebsites} from "@/lib/team/public";
import type {TeamMember} from "@/lib/api/team";

export async function getPublishedTeam(): Promise<TeamMember[]> {
  // Public presentation requires explicit publication; roles are never a roster.
  const configured = (process.env.PUBLIC_TEAM_PROFILE_IDS ?? "").split(",").filter(value => /^\d+$/.test(value.trim())).map(Number).filter(Number.isSafeInteger);
  if (!configured.length) return [];
  const profiles = await prisma.personProfile.findMany({where: {pr_id: {in: configured}}, select: {pr_id: true, user_id: true}, orderBy: {pr_id: "asc"}});
  const ids = profiles.map(profile => profile.user_id);
  const users = await prisma.user.findMany({where: {id: {in: ids}}, select: {id: true, fname: true, lname: true}});
  const images = await prisma.image.findMany({where: {ownerId: {in: ids}, type: "PROFILE"}, select: {ownerId: true, url: true, altText: true}});
  return users.map(user => {
    const image = images.find(item => item.ownerId === user.id);
    const imageUrl = image ? publicTeamImageUrl(image.url) : null;
    const profile = profiles.find(item => item.user_id === user.id);
    return {
      user: {fname: user.fname, lname: user.lname},
      image: image && imageUrl ? {url: imageUrl, altText: image.altText} : null,
      websiteUrl: profile ? teamWebsites[profile.pr_id] ?? null : null,
    };
  });
}
