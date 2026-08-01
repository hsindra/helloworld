# Cifras em graus (Nashville Number System) com transposição na visualização

## Contexto

Hoje o app salva e renderiza cifras sempre em acordes concretos (ex: `[Am]`, `[C]`, `[G7]`). O `chordpro` é a fonte de verdade tanto no banco (`SavedSong.chordpro`, `lib/store.ts:25-34`) quanto na busca de cifras novas (`buildChordPro`, `lib/chordpro.ts:74-83`, chamado a partir de `toSongResult` em `app/api/search/route.ts:14-26`). Não existe nenhum motor de transposição no projeto — os acordes são strings opacas do primeiro fetch até a tela.

Objetivo: o `chordpro` persistido passa a ser **sempre em graus** (Nashville Number System), independente de tom. Na visualização, o usuário escolhe ver em graus ou transposto para qualquer tom concreto. Isso resolve de forma definitiva o problema de "salvar cópia em tom + cópia em graus" — só existe uma fonte de verdade (graus), e o tom concreto é sempre derivado na hora de exibir.

**Decisões já tomadas com o usuário:**
- Notação de armazenamento: **Nashville Number System** — `[1]`, `[4]`, `[5]`, `[6m]`, `[2m7]`, `[5/7]` (número do grau + qualidade/extensão do acorde original + baixo também convertido, se houver).
- Migração: **converter todas as músicas já salvas de uma vez** (script/endpoint one-off), não deixar dois formatos coexistindo.
- Modo padrão ao abrir uma música: **"Em graus"** (usuário troca para um tom concreto via seletor se quiser).

## Escopo técnico

### 1. Motor de transposição (novo) — `lib/transpose.ts`
- Reaproveitar o regex `CHORD_TOKEN` de `lib/chordpro.ts:1-3` (já separa root / qualidade / extensão / baixo) em vez de duplicar a gramática de acorde.
- `parseChordToken(token)` → `{ root, quality, bass? }`.
- Tabela de classes de altura (C=0 … B=11), com suporte a sustenidos e bemóis.
- `chordToNashville(chordToken, key)` — calcula a distância em semitons entre a nota do acorde e a tônica da `key`, mapeia para grau 1–7 (com acidente `#`/`b` quando o acorde é emprestado/fora da escala), mantém a qualidade/extensão originais como sufixo, converte o baixo (slash) recursivamente.
- `nashvilleToChord(nashvilleToken, key)` — inverso: grau + acidente + `key` → nota concreta; mantém sufixo e baixo.
- Testes unitários em `lib/transpose.test.ts` (mesmo padrão de `lib/chordpro.test.ts`, test runner nativo do Node): acordes diatônicos maiores/menores, sétimas/extensões, slash chords, acordes emprestados, tons com sustenido e com bemol, ida e volta (chord → nashville → chord deve ser idempotente).

### 2. Conversão em lote do texto ChordPro — `lib/chordpro.ts`
- `parseChordProBody` já extrai os chunks de acorde como string opaca — nenhuma mudança estrutural no parser, ele continua funcionando com tokens Nashville sem alteração.
- Novas funções `convertChordProToNashville(chordpro, key)` e `convertChordProFromNashville(chordpro, key)`: percorrem as linhas de acorde via `parseChordProBody`, trocam cada `chunk.chord` pela conversão (`chordToNashville`/`nashvilleToChord` de `lib/transpose.ts`), remontam a linha.

### 3. Fluxo de busca de cifra — `app/api/search/route.ts`, `lib/cifraclub.ts`
- Em `toSongResult` (`route.ts:14-26`), após `buildChordPro(meta, rawText)` (que gera o chordpro concreto a partir do texto raspado), aplicar `convertChordProToNashville(chordproConcreto, meta.key)` antes de devolver ao cliente.
- Se `meta.key` não for detectado (regex `Tom\s*:?\s*([A-G]...)` em `lib/cifraclub.ts:291` não bater) não há como converter com segurança — bloquear com mensagem de erro explicando que o tom não foi identificado, em vez de assumir um tom arbitrário.
- A partir daqui, **toda cifra buscada já chega em graus** — cumpre o pedido original sem precisar guardar duas cópias.

### 4. Armazenamento — `lib/store.ts`, `lib/types.ts`
- `SavedSong.chordpro` (linha 31) passa a sempre conter o chordpro em graus. Nenhuma mudança de schema (continua `string`) — só muda o conteúdo.
- `SavedSong.key` (linha 28, hoje opcional) passa a ser indispensável — é a referência necessária para reconverter para qualquer tom concreto. Avaliar torná-lo obrigatório no tipo e validar no `POST`/`PUT` de `app/api/songs/route.ts` e `app/api/songs/[id]/route.ts`.

### 5. Migração das músicas existentes
- Script/endpoint one-off (ex: `scripts/migrate-to-nashville.ts` ou `POST /api/admin/migrate-to-nashville` protegido) que lista todas as `SavedSong` (`listSongs`), aplica `convertChordProToNashville(song.chordpro, song.key)` e regrava via `saveSong`.
- Músicas sem `key` salva ficam de fora da conversão automática e são reportadas numa lista para revisão manual (não dá para inferir o tom com segurança sem heurística adicional).
- Rodar uma única vez em produção; o script pode ser removido depois ou mantido como utilitário administrativo.

### 6. Visualização com seletor de tom — `app/ChordProView.tsx`, `app/page.tsx`
- `ChordProView` passa a receber uma prop `viewKey: 'graus' | string` além do `key` original da música (necessário como referência).
- Ao renderizar cada chunk de acorde: se `viewKey === 'graus'`, mostra o token Nashville como está; senão, aplica `nashvilleToChord(chunk.chord, viewKey)` e mostra o acorde concreto.
- Novo seletor de tom (dropdown "Graus" + as 12 notas, com relativas maior/menor) próximo aos badges de header em `app/page.tsx` (região das linhas ~270-288), com estado local `viewKey` inicializado em `'graus'`.
- Escolha de tom de visualização fica como estado de sessão (não persiste no banco) — fora de escopo desta primeira versão; pode virar extensão futura (lembrar por música via localStorage).

### 7. Edição manual (textarea) — `app/page.tsx`
- O textarea de edição bruta (`viewMode === 'code'`, linha ~308) hoje edita o chordpro concreto diretamente. Com a mudança, o texto editável passa a ser o chordpro **em graus** — quem edita manualmente vai digitar `[6m]` em vez de `[Am]`.
- Isso é uma mudança de UX perceptível. Fica marcado como ponto em aberto: se for necessário um modo de edição "em tom concreto" que converte para graus só ao salvar, isso é uma v2 — não incluído neste escopo inicial.

## Casos de borda

- Acordes fora da escala diatônica da `key` (empréstimos modais, dominantes secundárias) → grau com acidente (`#4`, `b7`, etc.) baseado na distância cromática mais próxima.
- Tom não detectado ao buscar cifra nova → bloquear conversão, não assumir tom default.
- Enarmonia (Db vs C#) → definir uma preferência de notação fixa para reconversão a tom concreto (ex: seguir a armadura de clave do tom escolhido).
- Músicas já salvas sem `key` → excluídas da migração automática, reportadas para ajuste manual.
- Tokens que não batem com `CHORD_TOKEN` (ex: `N.C.`, anotações livres) → preservados como estão, sem tentativa de conversão.

## Verificação

- `lib/transpose.test.ts`: casos diatônicos, extensões, slash chords, acordes emprestados, tons com sustenido/bemol, round-trip chord→nashville→chord.
- Buscar uma cifra nova via `/api/search` e inspecionar o `chordpro` retornado — deve vir em graus.
- Rodar a migração num ambiente local (Redis dev) e comparar 2–3 músicas antes/depois: o tom original reconvertido deve reproduzir exatamente os acordes que existiam antes.
- Na UI: abrir uma música salva, confirmar que abre em "Graus", trocar o seletor para um tom concreto e conferir que os acordes exibidos fazem sentido musicalmente.
