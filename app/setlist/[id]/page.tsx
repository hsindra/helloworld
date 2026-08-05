import Home from '../../HomeShell';

// Mesma ideia de app/song/[id]/page.tsx, mas pra setlist — ver comentário lá.
export default function SetlistPage({ params }: { params: { id: string } }) {
  return <Home initialSetlistId={params.id} />;
}
