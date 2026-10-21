ALTER TABLE "reservations" ALTER COLUMN "gratuity_pct" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "meet_greet" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "outside_sf" boolean DEFAULT false NOT NULL;