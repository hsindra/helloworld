# Cifra Club → ChordPro

Aplicação web (Next.js) que busca uma música no [Cifra Club](https://www.cifraclub.com.br)
a partir do nome do artista e da música, extrai a letra com os acordes e monta um
arquivo [ChordPro](https://www.chordpro.org/) (`.cho`) pronto pra baixar.

## Como funciona

1. **Busca** (`lib/cifraclub.ts`): a partir de artista + música, monta a URL no
   padrão do Cifra Club (`/artista-slug/musica-slug/`); se a página não existir,
   cai para a busca do próprio site (`/busca/?q=...`) e pega o primeiro resultado
   que parece ser uma página de música.
2. **Scraping**: baixa o HTML da página encontrada e localiza o bloco `<pre>`
   que contém a cifra (acordes acima da letra), além de título, artista, tom e
   capotraste.
3. **Conversão** (`lib/chordpro.ts`): converte o formato "acordes acima da letra"
   para ChordPro, inserindo cada acorde como `[Acorde]` na posição correta da
   linha de letra logo abaixo (ou como uma linha `[C] [G] [Am]` quando o trecho
   é só instrumental).
4. A rota `app/api/chordpro/route.ts` expõe isso como `POST /api/chordpro`
   (`{ artist, song }` → `{ chordpro, title, artist, key, capo, sourceUrl }`),
   e `app/page.tsx` é a interface: formulário, preview do ChordPro e botão de
   download do `.cho`.

## Rodando localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## Testes

A lógica de conversão para ChordPro tem testes unitários (sem depender de rede):

```bash
npm test
```

## Deploy na Vercel

O projeto já é um app Next.js padrão, então basta:

1. Importar o repositório em https://vercel.com/new
2. Framework preset: **Next.js** (detectado automaticamente)
3. Deploy — não há variáveis de ambiente obrigatórias.

## Limitações conhecidas

- O scraping depende da estrutura atual do HTML do Cifra Club; se o site mudar
  o layout, os seletores em `lib/cifraclub.ts` podem precisar de ajuste.
- A busca por artista + música tenta primeiro adivinhar a URL (slug) e, se
  falhar, usa a busca interna do site — em casos ambíguos (várias versões da
  mesma música, artistas com nomes parecidos) pode não pegar o resultado
  esperado.
- Sem cache/rate limiting — evite fazer muitas requisições em sequência para
  não sobrecarregar o Cifra Club.

## Uso e direitos autorais

Letras e cifras pertencem aos respectivos autores e ao Cifra Club. Este projeto
é para uso pessoal/educacional (montar seus próprios arquivos ChordPro); não
redistribua o conteúdo extraído.
