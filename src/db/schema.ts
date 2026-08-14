import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const guestBook = sqliteTable(
  "GuestBook",
  {
    id: integer("id").primaryKey(),
    author: text("author").notNull(),
    link: text("link"),
    content: text("content").notNull(),
    country: text("country").notNull(),
    timestamp: text("timestamp").notNull(),
  },
  (table) => [index("timestamp_idx").on(table.timestamp)],
);

export const stamps = sqliteTable("Stamps", {
  country: text("country").primaryKey(),
  imageUrl: text("imageUrl").notNull(),
  hue: integer("hue").notNull(),
});
