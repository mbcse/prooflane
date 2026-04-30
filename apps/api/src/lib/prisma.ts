import type { PrismaClient } from "@prisma/client";
import mod from "@openagents/core/db";

/** tsx/Node ESM loads `@openagents/core/db` as a namespace `{ default, prisma }`; unwrap the client. */
const prisma = (mod as { default: PrismaClient }).default;

export default prisma;
export { prisma };
