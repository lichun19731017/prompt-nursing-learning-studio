CREATE TABLE `conclusions` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` integer NOT NULL,
	`group_id` integer NOT NULL,
	`choice` text NOT NULL,
	`evidence` text NOT NULL,
	`reason` text NOT NULL,
	`rewrite` text NOT NULL,
	`uncertainty` text NOT NULL,
	`owner` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conclusions_class_group` ON `conclusions` (`class_id`,`group_id`);--> statement-breakpoint
CREATE TABLE `pairs` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` integer NOT NULL,
	`group_id` integer NOT NULL,
	`pair_no` integer NOT NULL,
	`members` integer NOT NULL,
	`change` text NOT NULL,
	`difference` text NOT NULL,
	`verification` text NOT NULL,
	`owner` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pairs_class_group_number` ON `pairs` (`class_id`,`group_id`,`pair_no`);