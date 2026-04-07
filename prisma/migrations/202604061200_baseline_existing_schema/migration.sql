-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "BuildVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "username" TEXT,
    "displayUsername" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isCommunityLeader" BOOLEAN NOT NULL DEFAULT false,
    "isModerator" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("organizationId","userId")
);

-- CreateTable
CREATE TABLE "builds" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "itemUniqueName" TEXT NOT NULL,
    "itemCategory" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemImageName" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "BuildVisibility" NOT NULL DEFAULT 'PUBLIC',
    "buildData" JSONB NOT NULL,
    "hasShards" BOOLEAN NOT NULL DEFAULT false,
    "hasGuide" BOOLEAN NOT NULL DEFAULT false,
    "searchVector" tsvector,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "favoriteCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "forkedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "builds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_guides" (
    "id" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "summary" VARCHAR(400),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "build_guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_links" (
    "id" TEXT NOT NULL,
    "fromBuildId" TEXT NOT NULL,
    "toBuildId" TEXT NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "build_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_votes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "build_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "build_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "scopes" TEXT[],
    "rateLimit" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_images" (
    "id" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "options" JSONB,
    "imageUrl" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PartnerBuilds" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PartnerBuilds_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_providerId_accountId_key" ON "accounts"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organization_members_userId_idx" ON "organization_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "builds_slug_key" ON "builds"("slug");

-- CreateIndex
CREATE INDEX "builds_userId_idx" ON "builds"("userId");

-- CreateIndex
CREATE INDEX "builds_itemUniqueName_idx" ON "builds"("itemUniqueName");

-- CreateIndex
CREATE INDEX "builds_visibility_idx" ON "builds"("visibility");

-- CreateIndex
CREATE INDEX "builds_voteCount_idx" ON "builds"("voteCount");

-- CreateIndex
CREATE INDEX "builds_createdAt_idx" ON "builds"("createdAt");

-- CreateIndex
CREATE INDEX "builds_visibility_voteCount_idx" ON "builds"("visibility", "voteCount");

-- CreateIndex
CREATE INDEX "builds_visibility_createdAt_idx" ON "builds"("visibility", "createdAt");

-- CreateIndex
CREATE INDEX "builds_userId_visibility_idx" ON "builds"("userId", "visibility");

-- CreateIndex
CREATE INDEX "builds_itemUniqueName_visibility_voteCount_idx" ON "builds"("itemUniqueName", "visibility", "voteCount");

-- CreateIndex
CREATE INDEX "builds_hasGuide_idx" ON "builds"("hasGuide");

-- CreateIndex
CREATE INDEX "builds_forkedFromId_idx" ON "builds"("forkedFromId");

-- CreateIndex
CREATE INDEX "builds_organizationId_idx" ON "builds"("organizationId");

-- CreateIndex
CREATE INDEX "builds_userId_visibility_voteCount_idx" ON "builds"("userId", "visibility", "voteCount");

-- CreateIndex
CREATE INDEX "builds_itemCategory_visibility_voteCount_idx" ON "builds"("itemCategory", "visibility", "voteCount");

-- CreateIndex
CREATE UNIQUE INDEX "build_guides_buildId_key" ON "build_guides"("buildId");

-- CreateIndex
CREATE INDEX "build_links_fromBuildId_idx" ON "build_links"("fromBuildId");

-- CreateIndex
CREATE INDEX "build_links_toBuildId_idx" ON "build_links"("toBuildId");

-- CreateIndex
CREATE UNIQUE INDEX "build_links_fromBuildId_toBuildId_key" ON "build_links"("fromBuildId", "toBuildId");

-- CreateIndex
CREATE INDEX "build_votes_buildId_idx" ON "build_votes"("buildId");

-- CreateIndex
CREATE UNIQUE INDEX "build_votes_userId_buildId_key" ON "build_votes"("userId", "buildId");

-- CreateIndex
CREATE INDEX "build_favorites_buildId_idx" ON "build_favorites"("buildId");

-- CreateIndex
CREATE UNIQUE INDEX "build_favorites_userId_buildId_key" ON "build_favorites"("userId", "buildId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE UNIQUE INDEX "generated_images_buildId_template_options_key" ON "generated_images"("buildId", "template", "options");

-- CreateIndex
CREATE INDEX "_PartnerBuilds_B_index" ON "_PartnerBuilds"("B");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builds" ADD CONSTRAINT "builds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builds" ADD CONSTRAINT "builds_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builds" ADD CONSTRAINT "builds_forkedFromId_fkey" FOREIGN KEY ("forkedFromId") REFERENCES "builds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_guides" ADD CONSTRAINT "build_guides_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_links" ADD CONSTRAINT "build_links_fromBuildId_fkey" FOREIGN KEY ("fromBuildId") REFERENCES "builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_links" ADD CONSTRAINT "build_links_toBuildId_fkey" FOREIGN KEY ("toBuildId") REFERENCES "builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_votes" ADD CONSTRAINT "build_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_votes" ADD CONSTRAINT "build_votes_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_favorites" ADD CONSTRAINT "build_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_favorites" ADD CONSTRAINT "build_favorites_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_images" ADD CONSTRAINT "generated_images_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PartnerBuilds" ADD CONSTRAINT "_PartnerBuilds_A_fkey" FOREIGN KEY ("A") REFERENCES "builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PartnerBuilds" ADD CONSTRAINT "_PartnerBuilds_B_fkey" FOREIGN KEY ("B") REFERENCES "builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
