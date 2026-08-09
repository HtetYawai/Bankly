/**
 * Seed script — creates the single admin account.
 *
 *   npm run seed:admin
 *
 * Reads credentials from ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD in .env.
 * Refuses to run if an admin account already exists — only one admin is allowed.
 * Safe to run multiple times; exits cleanly without making changes on every
 * subsequent call.
 */

import dotenv from "dotenv";
dotenv.config(); // must run before process.env is read anywhere below

import mongoose from "mongoose";
import { connectDB } from "../lib/db.js";
import Admin from "../models/admin.model.js";

// ── env validation ────────────────────────────────────────────────────────────

function validateEnv() {
  const missing = [];
  if (!process.env.ADMIN_NAME?.trim())     missing.push("ADMIN_NAME");
  if (!process.env.ADMIN_EMAIL?.trim())    missing.push("ADMIN_EMAIL");
  if (!process.env.ADMIN_PASSWORD?.trim()) missing.push("ADMIN_PASSWORD");

  if (missing.length > 0) {
    console.error(
      `[seed:admin] Missing required environment variable(s): ${missing.join(", ")}`
    );
    console.error("  Add them to backend/.env and try again.");
    process.exit(1);
  }

  const name  = process.env.ADMIN_NAME.trim();
  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD; // plain text — never logged

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailPattern.test(email)) {
    console.error(`[seed:admin] ADMIN_EMAIL is not a valid email address.`);
    process.exit(1);
  }

  if (name.length < 2) {
    console.error("[seed:admin] ADMIN_NAME must be at least 2 characters.");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("[seed:admin] ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  return { name, email, password };
}

// ── seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  const { name, email, password } = validateEnv();

  // Connect using the shared helper so the connection string comes from a
  // single source of truth (MONGODB_URL in .env).
  await connectDB();

  // connectDB() swallows its own errors, so verify the connection state
  // explicitly before touching any collections.
  if (mongoose.connection.readyState !== 1) {
    console.error(
      "[seed:admin] Could not connect to MongoDB. Check MONGODB_URL in .env."
    );
    process.exit(1);
  }

  // ── guard: only one admin is ever allowed ──────────────────────────────────

  const anyAdmin = await Admin.findOne({});
  if (anyAdmin) {
    console.log(
      `[seed:admin] An admin account already exists (${anyAdmin.email}).`
    );
    console.log("  Only one admin is allowed. No changes were made.");
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── guard: email collision ─────────────────────────────────────────────────
  // Catches a partial state where someone manually inserted a document with
  // a matching email but the first guard did not fire.

  const emailTaken = await Admin.findOne({ email });
  if (emailTaken) {
    console.log(
      `[seed:admin] A document with email "${email}" already exists in the admins collection.`
    );
    console.log("  No changes were made.");
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── create ─────────────────────────────────────────────────────────────────
  // passwordHash receives plain text here. The Admin model's pre-save hook
  // detects isModified("passwordHash") and hashes it with bcrypt before write.
  // Plain text is never stored and is not logged anywhere in this script.

  const admin = await Admin.create({
    name,
    email,
    passwordHash: password,
    status: "ACTIVE",
  });

  console.log("[seed:admin] Admin account created successfully.");
  console.log(`  Name  : ${admin.name}`);
  console.log(`  Email : ${admin.email}`);
  console.log(`  ID    : ${admin._id}`);
  // password intentionally omitted from all log output

  await mongoose.disconnect();
  console.log("[seed:admin] Disconnected. Done.");
}

seed().catch((err) => {
  console.error("[seed:admin] Unexpected error:", err.message);
  process.exit(1);
});
