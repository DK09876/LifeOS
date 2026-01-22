import { NextResponse } from 'next/server';
import { getDomains } from '@/lib/notion';

export async function GET() {
  try {
    const domains = await getDomains();
    return NextResponse.json(domains);
  } catch (error) {
    console.error('Error fetching domains:', error);
    return NextResponse.json({ error: 'Failed to fetch domains' }, { status: 500 });
  }
}
