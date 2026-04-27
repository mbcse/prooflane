-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('GITHUB', 'AWS');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "ComplianceRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ControlResultStatus" AS ENUM ('PASS', 'FAIL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PolicyDocumentKind" AS ENUM ('SECURITY', 'IR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "config" JSONB NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "triggeredByUserId" TEXT NOT NULL,
    "status" "ComplianceRunStatus" NOT NULL DEFAULT 'PENDING',
    "overallScore" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "storageRootHash" TEXT,
    "storageTxHash" TEXT,
    "ogEvidenceUri" TEXT,
    "ogEvidenceHash" TEXT,
    "routerModel" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "ComplianceRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlResult" (
    "id" TEXT NOT NULL,
    "complianceRunId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "status" "ControlResultStatus" NOT NULL,
    "rawData" JSONB NOT NULL,
    "evidencePointer" TEXT,
    "message" TEXT NOT NULL,

    CONSTRAINT "ControlResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "complianceRunId" TEXT NOT NULL,
    "aiSummary" TEXT NOT NULL,
    "aiDetails" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "PolicyDocumentKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageRootHash" TEXT,
    "storageTxHash" TEXT,
    "textExtract" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_ownerUserId_idx" ON "Organization"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_organizationId_type_key" ON "Integration"("organizationId", "type");

-- CreateIndex
CREATE INDEX "ComplianceRun_organizationId_startedAt_idx" ON "ComplianceRun"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "ControlResult_complianceRunId_idx" ON "ControlResult"("complianceRunId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_complianceRunId_key" ON "Report"("complianceRunId");

-- CreateIndex
CREATE INDEX "PolicyDocument_organizationId_kind_idx" ON "PolicyDocument"("organizationId", "kind");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceRun" ADD CONSTRAINT "ComplianceRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceRun" ADD CONSTRAINT "ComplianceRun_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlResult" ADD CONSTRAINT "ControlResult_complianceRunId_fkey" FOREIGN KEY ("complianceRunId") REFERENCES "ComplianceRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_complianceRunId_fkey" FOREIGN KEY ("complianceRunId") REFERENCES "ComplianceRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyDocument" ADD CONSTRAINT "PolicyDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

