import { NextRequest, NextResponse } from 'next/server';
import fetch from 'node-fetch';
import { agent } from '../../../lib/https-agent';


const SYSTEM_API_URL = `${process.env.APP_API_URL}/items`;

export async function GET() {
  try {
    const response = await fetch(SYSTEM_API_URL, {
      agent,
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await fetch(SYSTEM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      agent,
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}