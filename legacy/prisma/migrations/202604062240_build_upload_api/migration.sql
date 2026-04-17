-- AlterTable
ALTER TABLE "api_keys" ALTER COLUMN "rateLimit" SET DEFAULT 60;

-- CreateTable
CREATE TABLE "api_key_rate_limit_windows" (
    "apiKeyId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "api_key_rate_limit_windows_pkey" PRIMARY KEY ("apiKeyId","windowStart")
);

-- CreateIndex
CREATE INDEX "api_key_rate_limit_windows_windowStart_idx" ON "api_key_rate_limit_windows"("windowStart");

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- AddForeignKey
ALTER TABLE "api_key_rate_limit_windows" ADD CONSTRAINT "api_key_rate_limit_windows_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
