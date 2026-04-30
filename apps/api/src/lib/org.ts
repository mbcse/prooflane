import prisma from "./prisma.js";

export async function assertOrgOwner(userId: string, organizationId: string) {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, ownerUserId: userId },
  });
  if (!org) {
    const err = new Error("You do not have access to this organization.");
    (err as Error & { statusCode: number }).statusCode = 403;
    throw err;
  }
  return org;
}
