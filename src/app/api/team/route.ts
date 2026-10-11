import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const profiles = await prisma.personProfile.findMany();

    const userIds = profiles
      .map((profile) => profile.user_id)
      .filter((userId): userId is string => Boolean(userId));

    if (userIds.length === 0) {
      return NextResponse.json([]);
    }

    const [users, images] = await Promise.all([
      prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },
        select: {
          id: true,
          fname: true,
          lname: true,
        },
      }),
      prisma.image.findMany({
        where: {
          ownerId: {
            in: userIds,
          },
          type: "PROFILE",
        },
      }),
    ]);

    const usersById = new Map(
      users.map((user) => [user.id, user]),
    );

    const imagesByOwnerId = new Map<
      string,
      (typeof images)[number]
    >();

    for (const image of images) {
      if (!imagesByOwnerId.has(image.ownerId)) {
        imagesByOwnerId.set(image.ownerId, image);
      }
    }

    const result = profiles.map((profile) => {
      const user = usersById.get(profile.user_id);
      const image = imagesByOwnerId.get(profile.user_id) ?? null;

      return {
        ...profile,
        user: user ?? null,
        image,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/team failed:", error);

    return NextResponse.json(
      {
        error: "Failed to load team",
      },
      {
        status: 500,
      },
    );
  }
}
