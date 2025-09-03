import { NextRequest, NextResponse } from 'next/server';
import fetch from 'node-fetch';
import https from 'https';
import fs from 'fs';
import path from 'path';

// Resolve and check certificate paths
const clientCertPath = path.resolve(process.cwd(), process.env.CLIENT_CERT!);
const clientKeyPath = path.resolve(process.cwd(), process.env.CLIENT_KEY!);
const caCertPath = path.resolve(process.cwd(), process.env.CA_CERT!);

if (!fs.existsSync(clientCertPath)) {
  throw new Error(`Client cert file not found: ${clientCertPath}`);
}
if (!fs.existsSync(clientKeyPath)) {
  throw new Error(`Client key file not found: ${clientKeyPath}`);
}
if (!fs.existsSync(caCertPath)) {
  throw new Error(`CA cert file not found: ${caCertPath}`);
}

const agent = new https.Agent({
  cert: fs.readFileSync(clientCertPath),
  key: fs.readFileSync(clientKeyPath),
  ca: fs.readFileSync(caCertPath),
  rejectUnauthorized: false, // Allow self-signed certs for testing
});

const BACKEND_URL = process.env.BACKEND_URL || 'https://localhost:8000';
const UPLOAD_URL = `${BACKEND_URL}/upload-items`;

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