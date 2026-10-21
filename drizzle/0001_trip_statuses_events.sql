CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"time" text,
	"title" text NOT NULL,
	"kind" text DEFAULT 'Note' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "trip_status_id" uuid;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "group_name" text;--> statement-breakpoint
CREATE INDEX "calendar_events_date_idx" ON "calendar_events" USING btree ("date");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_trip_status_id_trip_statuses_id_fk" FOREIGN KEY ("trip_status_id") REFERENCES "public"."trip_statuses"("id") ON DELETE set null ON UPDATE no action;