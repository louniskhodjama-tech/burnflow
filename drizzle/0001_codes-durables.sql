ALTER TABLE "access_codes" ADD COLUMN "last_used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "access_codes" ADD COLUMN "use_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "access_codes" ADD COLUMN "revoked_at" timestamp with time zone;