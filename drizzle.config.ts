import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "turso",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url: process.env.ASTRO_DB_REMOTE_URL!,
    authToken: process.env.ASTRO_DB_APP_TOKEN,
  },
});
