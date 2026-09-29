-- Hand-written. drizzle-kit generated `ALTER TABLE meetings ADD person_id
-- integer NOT NULL`, which passes on an empty table and fails on any volume
-- that has meetings ("Cannot add a NOT NULL column with default value
-- NULL"), and it had dropped ON DELETE CASCADE besides. This is SQLite's
-- documented rebuild instead: new tables, copy, drop old, rename. It relies
-- on foreign keys being off while migrating (src/lib/open-db.ts); otherwise
-- dropping `meetings` would cascade into `occurrences` mid-copy.
--
-- Meetings stop being shared rows: each shared meeting fans out into one
-- copy per person holding its class, dates and all. A meeting of a class
-- nobody holds has no one to belong to and goes.
CREATE TABLE `__new_meetings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`class_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`day` integer NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`room` text,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "meetings_weekday" CHECK("__new_meetings"."day" between 1 and 5),
	CONSTRAINT "meetings_ordered" CHECK("__new_meetings"."start" >= 0 and "__new_meetings"."start" < "__new_meetings"."end" and "__new_meetings"."end" <= 1440)
);
--> statement-breakpoint
INSERT INTO `__new_meetings` (`class_id`, `person_id`, `day`, `start`, `end`, `room`)
	SELECT m.`class_id`, p.`person_id`, m.`day`, m.`start`, m.`end`, m.`room`
	FROM `meetings` m JOIN `picks` p ON p.`class_id` = m.`class_id`;
--> statement-breakpoint
CREATE TABLE `__new_occurrences` (
	`meeting_id` integer NOT NULL,
	`date` text NOT NULL,
	PRIMARY KEY(`meeting_id`, `date`),
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "occurrences_iso_date" CHECK("__new_occurrences"."date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
-- each old meeting's dates, once per copy; the copy is found by its natural
-- key (class, person, slot), which the old unique index made unambiguous
INSERT INTO `__new_occurrences` (`meeting_id`, `date`)
	SELECT n.`id`, o.`date`
	FROM `occurrences` o
	JOIN `meetings` m ON m.`id` = o.`meeting_id`
	JOIN `__new_meetings` n ON n.`class_id` = m.`class_id` AND n.`day` = m.`day` AND n.`start` = m.`start` AND n.`end` = m.`end`;
--> statement-breakpoint
DROP TABLE `occurrences`;--> statement-breakpoint
DROP TABLE `meetings`;--> statement-breakpoint
ALTER TABLE `__new_meetings` RENAME TO `meetings`;--> statement-breakpoint
ALTER TABLE `__new_occurrences` RENAME TO `occurrences`;--> statement-breakpoint
CREATE UNIQUE INDEX `meetings_person_class_slot` ON `meetings` (`person_id`,`class_id`,`day`,`start`,`end`);
