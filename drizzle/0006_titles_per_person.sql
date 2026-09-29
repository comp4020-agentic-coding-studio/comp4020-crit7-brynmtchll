ALTER TABLE `picks` ADD `course_title` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- hand-written: give every existing pick the title its course had, before
-- the shared column goes
UPDATE `picks` SET `course_title` = (
	SELECT co.`title` FROM `classes` c JOIN `courses` co ON co.`code` = c.`course_code`
	WHERE c.`id` = `picks`.`class_id`
);--> statement-breakpoint
ALTER TABLE `courses` DROP COLUMN `title`;