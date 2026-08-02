import { NextRequest, NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/store';

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao carregar configurações.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  try {
    const settings = await saveSettings({
      convertMinorToRelativeMajor: body?.convertMinorToRelativeMajor !== false,
      stripTablature: body?.stripTablature === true,
    });
    return NextResponse.json({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar configurações.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
