import { NextRequest, NextResponse } from 'next/server';
import fetch from 'node-fetch';
import { agent } from '../../../../lib/https-agent';


const SYSTEM_API_URL = `${process.env.APP_API_URL}/items`;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const response = await fetch(`${SYSTEM_API_URL}/${id}`, {
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
    const response = await fetch(`${SYSTEM_API_URL}/${id}`, {
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
    const response = await fetch(`${SYSTEM_API_URL}/${id}`, {
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