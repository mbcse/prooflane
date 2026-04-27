-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "productSummary" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "primaryComplianceGoal" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "onboardingSkippedAt" TIMESTAMP(3);
