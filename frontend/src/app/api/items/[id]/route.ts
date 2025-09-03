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

const BACKEND_URL = `${process.env.BACKEND_URL}/items`;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const response = await fetch(`${BACKEND_URL}/${id}`, {
      agent,
    });
    if (!response.ok) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch item' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const response = await fetch(`${BACKEND_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      agent,
    });
    if (!response.ok) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const response = await fetch(`${BACKEND_URL}/${id}`, {
      method: 'DELETE',
      agent,
    });
    if (!response.ok) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Item deleted' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}