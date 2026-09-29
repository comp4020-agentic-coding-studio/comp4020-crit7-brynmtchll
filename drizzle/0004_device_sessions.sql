CREATE TABLE `device_links` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`person_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`person_id` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- hand-written: carry every existing device's token over before the column
-- goes, so nobody is signed out by the deploy
INSERT INTO `sessions` (`token_hash`, `person_id`, `created_at`) SELECT `token_hash`, `id`, `created_at` FROM `people`;--> statement-breakpoint
DROP INDEX `people_token_hash_unique`;--> statement-breakpoint
ALTER TABLE `people` DROP COLUMN `token_hash`;