-- AlterTable
ALTER TABLE `ai_usage_limits` ALTER COLUMN `chat_date` DROP DEFAULT;

-- AlterTable
ALTER TABLE `user_profiles` ALTER COLUMN `last_active_date` DROP DEFAULT;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `password` VARCHAR(255) NULL;
