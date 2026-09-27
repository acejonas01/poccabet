-- Chat replies: a message can quote an earlier one.
-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "reply_to_id" TEXT;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
