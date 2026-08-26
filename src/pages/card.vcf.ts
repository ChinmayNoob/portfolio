import type { APIRoute } from 'astro';
import { buildVcard } from '~/data/vcard';

/**
 * Serves the same record the card's QR encodes, so the web view of /card has a
 * click-to-save path on desktop where scanning is awkward.
 */
export const prerender = true;

export const GET: APIRoute = () =>
  new Response(buildVcard(), {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': 'attachment; filename="chinmay-sawant.vcf"',
    },
  });
