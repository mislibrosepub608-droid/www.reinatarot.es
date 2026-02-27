CREATE TABLE `bonos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`sessions` int NOT NULL,
	`price` decimal(8,2) NOT NULL,
	`originalPrice` decimal(8,2),
	`validDays` int DEFAULT 365,
	`active` boolean DEFAULT true,
	`featured` boolean DEFAULT false,
	`stripePriceId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bonos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tarotistaId` int NOT NULL,
	`title` varchar(256),
	`status` enum('active','closed') DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chat_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `luna_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionKey` varchar(128) NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `luna_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `resenas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tarotistaId` int NOT NULL,
	`rating` int NOT NULL,
	`title` varchar(256),
	`content` text,
	`approved` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `resenas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reservas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`tarotistaId` int NOT NULL,
	`guestName` varchar(128),
	`guestEmail` varchar(320),
	`guestPhone` varchar(32),
	`scheduledAt` timestamp NOT NULL,
	`duration` int DEFAULT 30,
	`consultationType` enum('chat','video','phone') DEFAULT 'chat',
	`question` text,
	`status` enum('pending','confirmed','completed','cancelled') DEFAULT 'pending',
	`notes` text,
	`price` decimal(8,2),
	`bonoId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reservas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tarotistas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`slug` varchar(128) NOT NULL,
	`tagline` varchar(256),
	`bio` text,
	`specialty` varchar(128),
	`specialties` text,
	`experience` int DEFAULT 1,
	`rating` decimal(3,2) DEFAULT '5.00',
	`reviewCount` int DEFAULT 0,
	`pricePerSession` decimal(8,2) DEFAULT '25.00',
	`available` boolean DEFAULT true,
	`featured` boolean DEFAULT false,
	`arcana` enum('mayor','menor','combinada') DEFAULT 'combinada',
	`style` varchar(128),
	`languages` varchar(128) DEFAULT 'Español',
	`responseTime` varchar(64) DEFAULT 'Inmediata',
	`totalConsultations` int DEFAULT 0,
	`systemPrompt` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tarotistas_id` PRIMARY KEY(`id`),
	CONSTRAINT `tarotistas_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `user_bonos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bonoId` int NOT NULL,
	`sessionsTotal` int NOT NULL,
	`sessionsUsed` int DEFAULT 0,
	`expiresAt` timestamp,
	`stripePaymentId` varchar(256),
	`status` enum('active','expired','exhausted') DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_bonos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `avatar` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;