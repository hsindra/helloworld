import { NextRequest, NextResponse } from 'next/server';
import { touchSongAccess } from '@/lib/store';

// Chamado (melhor esforço, sem bloquear a UI) toda vez que a música é aberta
// na visualização — separado do PUT principal pra não exigir o corpo
// inteiro (título/chordpro/etc) só pra marcar um acesso.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await touchSongAccess(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao registrar acesso.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
