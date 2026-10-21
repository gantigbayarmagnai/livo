CREATE TYPE "public"."driver_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('quote', 'unassigned', 'assigned', 'en_route', 'on_location', 'passenger_on_board', 'done', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('point_to_point', 'airport_arrival', 'airport_departure', 'hourly', 'round_trip');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_number" serial NOT NULL,
	"company" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text,
	"email" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_account_number_unique" UNIQUE("account_number")
);
--> statement-breakpoint
CREATE TABLE "driver_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text,
	"email" text,
	"status" "driver_status" DEFAULT 'active' NOT NULL,
	"color" text DEFAULT '#64748b' NOT NULL,
	"default_vehicle_id" uuid
);
--> statement-breakpoint
CREATE TABLE "reservation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conf_number" serial NOT NULL,
	"account_id" uuid,
	"status" "reservation_status" DEFAULT 'unassigned' NOT NULL,
	"service_type" "service_type" DEFAULT 'point_to_point' NOT NULL,
	"passenger_name" text NOT NULL,
	"passenger_phone" text,
	"passenger_count" integer DEFAULT 1 NOT NULL,
	"luggage_count" integer DEFAULT 0 NOT NULL,
	"pickup_at" timestamp with time zone NOT NULL,
	"est_duration_min" integer DEFAULT 60 NOT NULL,
	"pickup_address" text NOT NULL,
	"dropoff_address" text,
	"stops" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"airline" text,
	"flight_number" text,
	"vehicle_type_id" uuid,
	"vehicle_id" uuid,
	"driver_id" uuid,
	"base_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"gratuity_pct" numeric(5, 2) DEFAULT '20' NOT NULL,
	"extras" numeric(10, 2) DEFAULT '0' NOT NULL,
	"customer_notes" text,
	"dispatch_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_conf_number_unique" UNIQUE("conf_number")
);
--> statement-breakpoint
CREATE TABLE "vehicle_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"capacity" integer NOT NULL,
	"base_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"hourly_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"min_hours" integer DEFAULT 2 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"vehicle_type_id" uuid NOT NULL,
	"plate" text,
	"color" text,
	"year" integer,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "driver_shifts" ADD CONSTRAINT "driver_shifts_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_default_vehicle_id_vehicles_id_fk" FOREIGN KEY ("default_vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_events" ADD CONSTRAINT "reservation_events_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_vehicle_type_id_vehicle_types_id_fk" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_vehicle_type_id_vehicle_types_id_fk" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "driver_shifts_driver_starts_idx" ON "driver_shifts" USING btree ("driver_id","starts_at");--> statement-breakpoint
CREATE INDEX "reservation_events_res_idx" ON "reservation_events" USING btree ("reservation_id","created_at");--> statement-breakpoint
CREATE INDEX "reservations_pickup_idx" ON "reservations" USING btree ("pickup_at");--> statement-breakpoint
CREATE INDEX "reservations_driver_pickup_idx" ON "reservations" USING btree ("driver_id","pickup_at");