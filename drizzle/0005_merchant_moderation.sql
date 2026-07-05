CREATE TYPE "public"."merchant_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "status" "merchant_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
-- Grandfather merchants that existed before moderation: treat them as approved.
UPDATE "merchants" SET "status" = 'approved';