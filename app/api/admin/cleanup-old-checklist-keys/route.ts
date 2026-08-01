import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// One-off cleanup for the checklist -> setlist rename: deletes leftover
// checklist:*/checklists:index keys orphaned by the storage-layer rename.
// Remove this route once run in production.
export async function POST() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    return NextResponse.json({ error: 'KV não configurado.' }, { status: 500 });
  }
  const redis = new Redis({ url, token });
  const keys = await redis.keys('checklist*');
  const deleted = keys.length > 0 ? await redis.del(...keys) : 0;
  return NextResponse.json({ found: keys, deleted });
}
