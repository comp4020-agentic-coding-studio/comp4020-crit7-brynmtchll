CREATE TABLE `occurrences` (
	`meeting_id` integer NOT NULL,
	`date` text NOT NULL,
	PRIMARY KEY(`meeting_id`, `date`),
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "occurrences_iso_date" CHECK("occurrences"."date" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
