import { prisma } from "@/lib/prisma";
import { privateJson, securityFailure } from "@/lib/security/http";

export async function GET() {
  try {
    // Public presentation requires explicit publication; role assignments are never a roster.
    const configured = (process.env.PUBLIC_TEAM_PROFILE_IDS ?? "").split(",").filter(value => /^\d+$/.test(value.trim())).map(Number).filter(Number.isSafeInteger);
    if (!configured.length) return privateJson([]);
    const profiles = await prisma.personProfile.findMany({ where: { pr_id: { in: configured } }, select: { user_id: true } });
    const ids = profiles.map(profile => profile.user_id);
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fname: true, lname: true } });
    const images = await prisma.image.findMany({ where: { ownerId: { in: ids }, type: "PROFILE" }, select: { ownerId: true, url: true, altText: true } });
    return privateJson(users.map(user => {
      const image = images.find(item => item.ownerId === user.id);
      return { user: { fname: user.fname, lname: user.lname }, image: image && /^https?:\/\//.test(image.url) ? { url: image.url, altText: image.altText } : null };
    }));
  } catch (error) { return securityFailure(error); }
}
