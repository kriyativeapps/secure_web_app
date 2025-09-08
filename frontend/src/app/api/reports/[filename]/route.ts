import { NextRequest, NextResponse } from 'next/server';
import fetch from 'node-fetch';
import { agent } from '../../../../lib/https-agent';
import { getReportUrl } from '../../../../lib/api-urls';


export async function GET(request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const { filename } = await params;
    const url = getReportUrl(filename);

    const response = await fetch(url, {
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