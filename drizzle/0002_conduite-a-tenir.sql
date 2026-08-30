CREATE TABLE "care_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"label" text NOT NULL,
	"section_title" text NOT NULL,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL,
	"by_user_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "care_actions" ADD CONSTRAINT "care_actions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_actions" ADD CONSTRAINT "care_actions_by_user_id_users_id_fk" FOREIGN KEY ("by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "care_actions_patient_item_uq" ON "care_actions" USING btree ("patient_id","item_key");--> statement-breakpoint
CREATE INDEX "care_actions_patient_idx" ON "care_actions" USING btree ("patient_id");