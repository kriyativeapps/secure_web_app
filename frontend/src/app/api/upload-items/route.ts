import { NextRequest, NextResponse } from 'next/server';
import fetch from 'node-fetch';
import { agent } from '../../../lib/https-agent';


const SYSTEM_API_URL = process.env.APP_API_URL || 'https://localhost:8001';
const UPLOAD_URL = `${SYSTEM_API_URL}/upload-items`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const backendFormData = new FormData();
    backendFormData.append('file', file);

    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      body: backendFormData,
      agent,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}