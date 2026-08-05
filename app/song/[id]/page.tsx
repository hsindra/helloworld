import Home from '../../HomeShell';

// Rota real só pra resolver link direto/compartilhado de uma música
// específica (load a frio) — a navegação interna entre músicas usa
// history.pushState direto (ver navigateTo em app/HomeShell.tsx), sem
// passar por aqui de novo.
export default function SongPage({ params }: { params: { id: string } }) {
  return <Home initialSongId={params.id} />;
}
