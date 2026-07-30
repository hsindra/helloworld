import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cifra Club → ChordPro',
  description: 'Busque uma música no Cifra Club e gere o arquivo ChordPro correspondente.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
