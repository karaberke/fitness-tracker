ALTER TABLE "exercises" ADD COLUMN "uses_machine" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "machine_id" integer;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE set null ON UPDATE no action;