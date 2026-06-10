import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js does not load .env.local for CLI commands; load it explicitly for Prisma
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"],
  },
});
