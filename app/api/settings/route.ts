import { NextRequest, NextResponse } from 'next/server';
import { getSettings, saveSettings, DEFAULT_SETTINGS } from '@/lib/store';

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao carregar configurações.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Limites generosos só pra impedir valores absurdos (ex: corpo malformado) —
// a faixa útil oferecida na UI (0.6–1.6) é bem mais estreita.
function clampFontSize(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(2, Math.max(0.5, n));
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  try {
    const settings = await saveSettings({
      convertMinorToRelativeMajor: body?.convertMinorToRelativeMajor !== false,
      stripTablature: body?.stripTablature === true,
      lyricFontSize: clampFontSize(body?.lyricFontSize, DEFAULT_SETTINGS.lyricFontSize),
      chordFontSize: clampFontSize(body?.chordFontSize, DEFAULT_SETTINGS.chordFontSize),
    });
    return NextResponse.json({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao salvar configurações.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
