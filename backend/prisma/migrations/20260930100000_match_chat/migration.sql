-- Live match chat and chat mutes. Not granted to analytics_reader (player-written text).
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "chat_muted_until" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_messages_match_id_created_at_idx" ON "chat_messages"("match_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages"("created_at");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

