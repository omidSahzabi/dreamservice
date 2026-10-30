import "server-only";
import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  (typeof global.prisma?.orderStatusHistory?.create === "function" &&
   typeof global.prisma?.userManagementAudit?.create === "function" &&
   typeof global.prisma?.project?.create === "function" &&
   typeof global.prisma?.supportTicket?.create === "function" ? global.prisma : undefined) ??
  new PrismaClient();

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
