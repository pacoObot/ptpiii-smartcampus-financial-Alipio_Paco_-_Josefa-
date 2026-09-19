BEGIN;

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('LOCAL_ONLY', 'PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "financial_notifications" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "correlationId" TEXT,
ADD COLUMN     "deliveryStatus" "NotificationDeliveryStatus" NOT NULL DEFAULT 'LOCAL_ONLY',
ADD COLUMN     "eventType" TEXT NOT NULL DEFAULT 'FINANCIAL_NOTICE',
ADD COLUMN     "externalNotificationId" TEXT,
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lockToken" TEXT,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "resourceId" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "financial_notifications_externalNotificationId_key" ON "financial_notifications"("externalNotificationId");

-- CreateIndex
CREATE INDEX "financial_notifications_deliveryStatus_nextAttemptAt_idx" ON "financial_notifications"("deliveryStatus", "nextAttemptAt");


-- Preserve historical local notices; only new notices enter the delivery queue.
ALTER TABLE "financial_notifications" ALTER COLUMN "deliveryStatus" SET DEFAULT 'PENDING';

COMMIT;
