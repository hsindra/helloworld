import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CifraX',
  description: 'Busque uma música no Cifra Club e gere o arquivo ChordPro correspondente.',
};

// maximumScale trava o zoom da página em 1x — sem isso, o iOS Safari dá
// zoom automático sempre que um campo de texto pequeno ganha foco (inclusive
// via foco programático, como o atalho [%]), fazendo a tela "flutuar" e a
// barra de ícones sticky sumir da vista. Com o zoom travado no viewport,
// isso não acontece mais, mesmo com a fonte do código pequena.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
