-- CreateTable
CREATE TABLE "SynonymGroup" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "SynonymGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SynonymTerm" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "term" TEXT NOT NULL,

    CONSTRAINT "SynonymTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SynonymTerm_term_key" ON "SynonymTerm"("term");

-- CreateIndex
CREATE INDEX "SynonymTerm_groupId_idx" ON "SynonymTerm"("groupId");

-- AddForeignKey
ALTER TABLE "SynonymTerm" ADD CONSTRAINT "SynonymTerm_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SynonymGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
