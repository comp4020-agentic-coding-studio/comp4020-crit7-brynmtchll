CREATE TABLE `classes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_code` text NOT NULL,
	`activity` text NOT NULL,
	`group` text NOT NULL,
	FOREIGN KEY (`course_code`) REFERENCES `courses`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classes_course_activity_group` ON `classes` (`course_code`,`activity`,`group`);--> statement-breakpoint
CREATE TABLE `courses` (
	`code` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `follows` (
	`follower_id` integer NOT NULL,
	`followee_id` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`follower_id`, `followee_id`),
	FOREIGN KEY (`follower_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`followee_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "follows_not_self" CHECK("follows"."follower_id" <> "follows"."followee_id")
);
--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`class_id` integer NOT NULL,
	`day` integer NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`room` text,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "meetings_weekday" CHECK("meetings"."day" between 1 and 5),
	CONSTRAINT "meetings_ordered" CHECK("meetings"."start" >= 0 and "meetings"."start" < "meetings"."end" and "meetings"."end" <= 1440)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meetings_class_slot` ON `meetings` (`class_id`,`day`,`start`,`end`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`share_code` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_share_code_unique` ON `people` (`share_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `people_token_hash_unique` ON `people` (`token_hash`);--> statement-breakpoint
CREATE TABLE `picks` (
	`person_id` integer NOT NULL,
	`class_id` integer NOT NULL,
	PRIMARY KEY(`person_id`, `class_id`),
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade
);
