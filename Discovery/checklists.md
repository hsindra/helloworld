# Checklists de músicas

## Contexto

Hoje o app tem um único jeito de olhar músicas salvas: uma de cada vez, via
"Minhas músicas" (`app/page.tsx`). Não existe um jeito de agrupar várias
músicas numa sequência fixa (ex: as músicas de um culto) e ler todas em
rolagem contínua numa única tela.

Objetivo: um **checklist** é uma lista nomeada de músicas já salvas, numa
ordem definida por quem monta. Ao abrir um checklist, a tela mostra as letras
+ cifras de todas as músicas, uma após a outra, em modo somente-leitura —
pensado pra usar durante o evento (culto, ensaio) sem precisar navegar
música por música.

Exemplo dado: checklist **"culto 02/08/26"** contendo **Só Tu És Santo** e
**Eu Vou Construir**, nessa ordem.

## Decisões confirmadas

- Botão **"Checklists"** ao lado do botão **"Minhas músicas"** (mesma linha,
  abaixo da caixa de busca).
- Clicar em "Checklists" mostra a lista de checklists existentes + um botão
  **"Criar checklist"**.
- Criar um checklist:
  - campo de texto pro **nome do checklist**;
  - campo de texto pra **buscar música salva** por nome + botão de lupa;
  - ao achar, clica em **"Adicionar"** pra incluir no checklist sendo
    montado (múltiplas músicas, uma de cada vez);
  - **"Salvar"** grava o checklist, que passa a aparecer na lista.
- Abrir um checklist mostra uma tela parecida com a visualização de música
  atual, mas **só o modo visualização** (sem alternância pra código
  ChordPro) — um texto único e grande com todas as músicas, na ordem em que
  foram adicionadas.
- Dentro do checklist aberto: botão **"Ordenar"** (reordenar as músicas) e
  botão **"Adicionar"** (incluir mais músicas sem recriar o checklist).
- **Referência, não cópia:** o checklist guarda os `id`s das músicas salvas
  (como `viewerMeta.id` já faz hoje). Editar a música original reflete
  automaticamente no checklist; apagar a música original faz o checklist
  mostrar "música removida" no lugar dela, sem quebrar o restante.
- **Reordenar por arrastar-e-soltar** (drag-and-drop) — adiciona
  `@dnd-kit/core` + `@dnd-kit/sortable` como dependência nova (funciona bem
  com toque, importante pra usar num culto pelo celular).
- **Apagar já na v1:** apagar um checklist inteiro (na lista de checklists)
  e remover uma música individual de dentro dele (na tela de ordenar).
- **Tom por música + toggle único do checklist** (refinamento do pedido
  original — ver seção seguinte).

### Pré-requisito já implementado: tom preferencial na música individual

Antes dos checklists, o conceito de **tom preferencial** já foi construído
na tela de música individual (`app/page.tsx`) — os checklists reaproveitam
esse campo em vez de reinventar o próprio:

- `SavedSong.preferredKey?: string` (`lib/store.ts`) — tom concreto que o
  usuário prefere tocar aquela música, independente do `key` original
  (tom de referência, usado só pra reconverter graus). Opcional; some UIs
  caem pra `preferredKey || key` quando ausente.
- No menu (☰) da música: um toggle **"Grau"** (liga/desliga a visualização
  em graus) e um combo **"Tom"** só com tons concretos (sem opção "Graus"
  nele). No combo, o tom original (`header.key`) aparece marcado em
  vermelho, o tom preferencial atual em azul.
- A tag depois do nome do artista (`· Tom: X`) mostra o tom preferencial
  atual, atualizando ao trocar o combo.
- Trocar o combo persiste na hora (`PUT /api/songs/{id}`, sem precisar de
  "Salvar") — reabrir a música depois já mostra o tom preferencial salvo.
- Na lista "Minhas músicas", cada item mostra o tom preferencial como tag
  entre parênteses: `Artista (E)`.

Isso já resolve, pros checklists, a pergunta "qual tom uma música toca por
padrão" — é sempre `song.preferredKey`, não o `song.key` original.

### Tom preferencial por música + toggle Graus/Tom do checklist

Cada música dentro de um checklist tem seu próprio **tom preferencial pro
checklist** — o tom em que ela será tocada *naquele evento específico*
(pode ser igual ou diferente do `preferredKey` geral da música). Esse tom:
- é definido por um seletor ao lado de cada música na visualização do
  checklist;
- vem **pré-preenchido com o tom preferencial já salvo na música**
  (`song.preferredKey`, caindo pra `song.key` se a música ainda não tiver
  um preferencial definido) quando ela é adicionada ao checklist — não o
  tom original;
- fica salvo como parte do item do checklist (persiste — não é só sessão),
  já que representa uma decisão do evento ("nesse culto, tocamos essa
  música em Ré", que pode não ser o tom que ela toca em outros contextos).

Além disso, o checklist tem **um único seletor global "Graus" / "Tom"** no
topo da tela de visualização, que controla como os **acordes** renderizam:
- **Graus** (padrão ao abrir): todas as músicas renderizam em graus
  (Nashville Number System), igual ao padrão de "Minhas músicas" hoje.
- **Tom**: cada música renderiza no seu **tom preferencial de checklist**
  (não um tom único pra todas).

**Independente do modo**, toda música no checklist mostra uma **tag fixa**
com o tom em que ela será tocada (o tom preferencial daquele item) — a tag
não some no modo "Graus", já que ela comunica uma informação diferente do
que está sendo renderizado (que grau tocar vs. que tom real aquilo
representa). A própria tag é o controle editável (um `<select>` compacto,
mesmo padrão visual do combo de tom da música individual) — trocar o valor
já salva.

## Wireframes

### 1. Tela inicial — botão novo ao lado de "Minhas músicas"

```
┌────────────────────────────────────────────────┐
│  CifraX                                         │
│                                                  │
│  ┌──────────────────────────────────┐ ┌───────┐ │
│  │ Música, artista + música, ou URL…│ │Buscar │ │
│  └──────────────────────────────────┘ └───────┘ │
│                                                  │
│  ( Minhas músicas )  ( Checklists )             │
│                                                  │
└────────────────────────────────────────────────┘
```

### 2. Lista de checklists

```
┌────────────────────────────────────────────────┐
│  ┌──────────────────────────────────┐ ┌───────┐ │
│  │ Música, artista + música, ou URL…│ │Buscar │ │
│  └──────────────────────────────────┘ └───────┘ │
│                                                  │
│  ( Minhas músicas )  ( Checklists ● )           │
│                                                  │
│  [ + Criar checklist ]                          │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │ culto 02/08/26              3 músicas [🗑]  │ │
│  ├────────────────────────────────────────────┤ │
│  │ culto 26/07/26              5 músicas [🗑]  │ │
│  ├────────────────────────────────────────────┤ │
│  │ ensaio quinta                2 músicas [🗑]  │ │
│  └────────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

*(estado vazio: "Nenhum checklist criado ainda.", mesmo padrão do estado
vazio de "Minhas músicas". `[🗑]` apaga o checklist, com confirmação.)*

### 3. Criar checklist

```
┌────────────────────────────────────────────────┐
│  ‹ voltar                                       │
│                                                  │
│  Nome do checklist                              │
│  ┌──────────────────────────────────────────┐  │
│  │ culto 02/08/26                            │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  Adicionar músicas salvas                       │
│  ┌────────────────────────────────┐ ┌────────┐ │
│  │ só tu és santo                  │ │  🔍    │ │
│  └────────────────────────────────┘ └────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐│
│  │ Só Tu És Santo — Diante do Trono            ││
│  │                                 [Adicionar] ││
│  └────────────────────────────────────────────┘│
│                                                  │
│  Músicas no checklist (2)                       │
│  1. Só Tu És Santo           (E)          [x]   │
│  2. Eu Vou Construir          (G)         [x]   │
│                                                  │
│                    [ Salvar checklist ]         │
└────────────────────────────────────────────────┘
```

- A busca filtra entre as músicas salvas (mesmo fuzzy-match de
  `lib/fuzzyMatch.ts` já usado no typeahead da busca principal), ao vivo
  enquanto digita — a lupa só reforça visualmente a ação (Enter também
  busca).
- "Adicionar" empilha na lista "Músicas no checklist", na ordem clicada,
  com o tom pré-preenchido = **tom preferencial já salvo na música**
  (`song.preferredKey || song.key`, editável depois na tela de
  visualização). `[x]` remove antes de salvar.
- "Salvar checklist" fica desabilitado sem nome ou sem nenhuma música.

### 4. Checklist aberto (visualização corrida, somente leitura)

```
┌────────────────────────────────────────────────┐
│  ‹ voltar   culto 02/08/26                      │
│                    (Graus | Tom) [↕ Ordenar] [+]│
│  ──────────────────────────────────────────────│
│  Só Tu És Santo                     Tom: [E ▾]  │
│  Diante do Trono                                │
│                                                  │
│    1          4         1                       │
│  Só tu és santo, só tu és digno de adoração     │
│    ...                                          │
│                                                  │
│  ──────────────────────────────────────────────│
│  Eu Vou Construir                   Tom: [G ▾]  │
│  Aline Barros                                   │
│                                                  │
│    1      5m       4                            │
│  Eu vou construir, com a palavra que ouvi       │
│    ...                                          │
│                                                  │
└────────────────────────────────────────────────┘

              (modo "Graus" — acordes em grau,
               tag Tom: [E ▾] continua visível)
```

- `(Graus | Tom)` é o toggle único do checklist. Controla só como os
  **acordes** renderizam: "Graus" mostra o corpo em Nashville Number
  System pra todas; "Tom" mostra cada música no seu tom preferencial de
  checklist. A tag `Tom: [E ▾]` **não depende do modo** — fica sempre
  visível ao lado do título de cada música, porque comunica "em que tom
  essa música vai ser tocada" independente de como o corpo está sendo lido
  no momento. É a mesma tag em ambos os modos, e já é o controle editável
  (trocar o valor persiste na hora).
- Cada música renderiza exatamente como `ChordProView` já faz hoje (mesmas
  cores/fontes), uma abaixo da outra, com um separador simples entre elas.
- Sem toggle "código ChordPro", sem menu de hambúrguer por música (isso já
  existe na tela de música individual) — aqui é leitura corrida + só os
  dois controles do checklist (Ordenar, Adicionar) e a tag/seletor de tom.

### 5. Ordenar músicas do checklist (arrastar e soltar)

```
┌────────────────────────────────────────────────┐
│  ‹ voltar   Ordenar — culto 02/08/26            │
│                                                  │
│  ⠿  1. Só Tu És Santo                     [x]   │
│  ⠿  2. Eu Vou Construir                   [x]   │
│  ⠿  3. Ninguém Explica Deus               [x]   │
│                                                  │
│  (arraste pela alça ⠿ pra reordenar)            │
│                    [ Concluir ]                 │
└────────────────────────────────────────────────┘
```

- `[x]` remove a música do checklist direto dessa tela.
- Ordem é salva ao soltar cada item (ou tudo de uma vez em "Concluir" — a
  confirmar na implementação, mas não muda a experiência do usuário).

### 6. Adicionar música a um checklist existente

Reaproveita a mesma UI de busca+adicionar da tela de criação (seção 3),
aberta como uma tela/painel sobre o checklist já salvo — sem precisar
recriar nada, só acrescenta músicas ao array existente (com tom
pré-preenchido = tom preferencial já salvo na música, igual na criação).

## Modelo de dados / escopo técnico

- **`lib/store.ts`** — novo tipo e CRUD espelhando o padrão de `SavedSong`:
  ```ts
  interface ChecklistItem {
    songId: string;
    /** Tom em que essa música será tocada nesse checklist específico.
     * Pré-preenchido com `song.preferredKey || song.key` ao adicionar,
     * editável depois. Sempre exibido como tag; só afeta a renderização
     * dos acordes quando o checklist está no modo "Tom". */
    preferredKey: string;
  }

  interface Checklist {
    id: string;
    name: string;
    items: ChecklistItem[]; // ordem = ordem de exibição
    createdAt: number;
  }
  ```
  `CHECKLIST_INDEX_KEY = 'checklists:index'`, chave `checklist:{id}`, mesmas
  funções (`saveChecklist`, `listChecklists`, `getChecklist`,
  `deleteChecklist`) no mesmo estilo de `saveSong`/`listSongs`/etc.
- **`app/api/checklists/route.ts`** — `GET` (lista) / `POST` (cria, recebe
  `name` + `items`).
- **`app/api/checklists/[id]/route.ts`** — `GET` (detalhe, já resolvendo os
  `songId` de cada item pra `SavedSong` via `getSong`, marcando como
  removida quando não encontrada) / `PUT` (renomear, reordenar,
  adicionar/remover música, trocar `preferredKey` — um único body com o
  array `items` final é suficiente pra cobrir tudo) / `DELETE`.
- **`app/page.tsx`** — estender `Mode` para incluir `'checklists'`; estado
  novo pro checklist aberto (`openChecklist`, modo `'graus' | 'tom'` local
  de sessão) e pro modo de construção/edição (nome + busca + lista
  temporária antes de salvar); a busca de músicas salvas reaproveita
  `savedSongs` (já carregado) + `songMatchScore`.
- **Novo componente `app/ChecklistView.tsx`** — recebe os `ChecklistItem[]`
  resolvidos (com a `SavedSong` de cada um) e renderiza um `ChordProView`
  por música com um separador e um seletor de tom, reaproveitando o
  componente existente sem duplicar a lógica de parsing/exibição.
- **Nova dependência:** `@dnd-kit/core` + `@dnd-kit/sortable` pra
  arrastar-e-soltar na tela de ordenar (única lib nova do projeto —
  `package.json` hoje não tem nenhuma lib de UI além de `react`/`next`).

## Casos de borda

- Checklist com 0 músicas — permite salvar, mostrando estado vazio
  ("Nenhuma música neste checklist ainda — toque em Adicionar.") na tela de
  visualização.
- Música referenciada no checklist foi apagada de "Minhas músicas" depois —
  mostrar um espaço reservado ("Música removida") no lugar dela, sem quebrar
  o restante do checklist; o seletor de tom dela some junto.
- Busca sem resultado nenhum na tela de criar/adicionar.
- Adicionar a mesma música duas vezes no mesmo checklist — permitido (pode
  fazer sentido repetir uma música num culto), cada ocorrência com seu
  próprio `preferredKey` independente.
- Nome do checklist vazio — bloqueia "Salvar checklist".
- Nome de checklist duplicado — permitido (mesmo padrão de "Minhas
  músicas", que também não bloqueia títulos repetidos).

## Verificação

- Criar o checklist do exemplo ("culto 02/08/26" com Só Tu És Santo + Eu Vou
  Construir) e confirmar que aparece na lista, na ordem certa ao abrir.
- Reordenar por drag-and-drop e confirmar que persiste após recarregar a
  página.
- Trocar o toggle Graus/Tom e confirmar que os acordes mudam de
  representação, mas a tag de tom de cada música continua visível nos dois
  modos.
- Trocar o tom preferencial de uma música dentro do checklist e confirmar
  que persiste, sem afetar o `preferredKey` da música em "Minhas músicas".
- Adicionar uma terceira música a um checklist já salvo.
- Apagar uma música de "Minhas músicas" que está num checklist e confirmar
  que o checklist não quebra.
- Testes automatizados pras funções novas de `lib/store.ts`, mesmo padrão
  dos testes existentes (`lib/chordpro.test.ts`, `lib/fuzzyMatch.test.ts`).
