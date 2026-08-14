---
label: wayfinder:grilling
status: closed
assignee: chinmay
blocks: []
blocked_by: [001-astro-db-cloudflare-compat.md]
---

# Which astro:db replacement and what sequencing?

## Question

Ticket 001 found `astro:db` is a hard blocker on Cloudflare. Two decisions this
surfaces: which client replaces it for `GuestBook`/`Stamps`, and whether that
replacement ships before the adapter swap or combined with it.

## Answer

- **Replacement: Drizzle ORM over libSQL.** Chosen over raw `@libsql/client/web` for
  typed queries and closer parity to `astro:db`'s existing schema/query ergonomics
  (worth the extra setup vs. hand-written SQL).
- **Sequencing: replace `astro:db` first, on Vercel, ship it, then swap the adapter.**
  De-risks the migration by verifying the new DB client independently of the hosting
  change — one variable at a time instead of a combined cutover.
