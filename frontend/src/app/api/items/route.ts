import { NextRequest, NextResponse } from 'next/server';
import fetch from 'node-fetch';
import https from 'https';
import fs from 'fs';
import path from 'path';

const agent = new https.Agent({
  cert: fs.readFileSync(path.join(process.cwd(), process.env.CLIENT_CERT!)),
  key: fs.readFileSync(path.join(process.cwd(), process.env.CLIENT_KEY!)),
  ca: fs.readFileSync(path.join(process.cwd(), process.env.CA_CERT!)),
  rejectUnauthorized: true,
});

const BACKEND_URL = `${process.env.BACKEND_URL}/items`;

export async function GET() {
  try {
    const response = await fetch(BACKEND_URL, {
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
    const response = await fetch(BACKEND_URL, {
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