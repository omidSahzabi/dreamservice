import "server-only";
import { Prisma } from "@prisma/client";
import { unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function projectQuery<T>(operation: "list" | "homepage", run: () => Promise<T>): Promise<T> {
  try { return await run(); }
  catch (error) {
    unstable_rethrow(error);
    const projectDelegateReady = typeof prisma.project?.findFirst === "function";
    const category = !projectDelegateReady ? "stale_prisma_client" :
      error instanceof Prisma.PrismaClientInitializationError ? "database_initialization" :
      error instanceof Prisma.PrismaClientKnownRequestError ? "database_query" :
      error instanceof Prisma.PrismaClientValidationError ? "prisma_validation" :
      error instanceof TypeError ? "type_error" : "unexpected";
    const code = error instanceof Prisma.PrismaClientKnownRequestError && /^P\d{4}$/.test(error.code) ? error.code : undefined;
    // Never log exception messages/stacks, query parameters, session data or URLs.
    console.warn(JSON.stringify({ event: "project_query_failed", operation, category, projectDelegateReady,
      ...(error instanceof TypeError ? { errorType: "TypeError" } : {}), ...(code ? { code } : {}) }));
    throw error;
  }
}
