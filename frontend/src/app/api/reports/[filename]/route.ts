import { NextRequest, NextResponse } from 'next/server';
import fetch from 'node-fetch';
import { agent } from '../../../../lib/https-agent';


export async function GET(request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const { filename } = await params;
    const SYSTEM_API_URL = `${process.env.APP_API_URL}/reports/${filename}`;

    const response = await fetch(SYSTEM_API_URL, {
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