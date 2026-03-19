import { Pool } from "pg";

// This file creates and exports a shared PostgreSQL connection pool.
// The pool will be reused across requests so that we do not create
// many connections every time an API route is called.
// Make sure to set DATABASE_URL in your .env file before running the app.

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // We throw a clear error during development if DATABASE_URL is missing.
  // This helps you quickly see what environment variable you must set.
  throw new Error(
    "DATABASE_URL is not set. Please add it to your .env file (PostgreSQL connection string)."
  );
}

export const pool = new Pool({
  connectionString,
});

export type EventType = "deadline" | "meeting" | "business_trip";

export interface EventRow {
  id: number;
  title: string;
  description: string | null;
  event_type: EventType;
  scheduled_at: Date;
  created_at: Date;
  updated_at: Date;
}

