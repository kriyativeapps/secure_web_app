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

export async function GET(request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const { filename } = await params;
    const BACKEND_URL = `${process.env.BACKEND_URL}/reports/${filename}`;

    const response = await fetch(BACKEND_URL, {
      agent,
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}