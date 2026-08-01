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

### Tom preferencial por música + toggle Graus/Tom do checklist

Cada música dentro de um checklist tem seu próprio **tom preferencial** —
o tom em que ela será tocada naquele evento (pode ser diferente do tom
original da música). Esse tom:
- é definido por um seletor ao lado de cada música na visualização do
  checklist;
- vem pré-preenchido com o tom original da música (`SavedSong.key`) quando
  ela é adicionada ao checklist;
- fica salvo como parte do item do checklist (persiste — não é só sessão),
  já que representa uma decisão do evento ("nesse culto, tocamos essa
  música em Ré").

Além disso, o checklist tem **um único seletor global "Graus" / "Tom"** no
topo da tela de visualização:
- **Graus** (padrão ao abrir): todas as músicas renderizam em graus
  (Nashville Number System), igual ao padrão de "Minhas músicas" hoje —
  o seletor de tom por música fica desabilitado/oculto, já que graus
  ignora tom concreto.
- **Tom**: cada música renderiza no seu **tom preferencial próprio** (não
  um tom único pra todas) — os seletores por música ficam visíveis e
  editáveis, e trocar um deles re-renderiza só aquela música no novo tom
  (e salva a escolha).

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
│  1. Só Tu És Santo          (tom: E)      [x]   │
│  2. Eu Vou Construir         (tom: G)     [x]   │
│                                                  │
│                    [ Salvar checklist ]         │
└────────────────────────────────────────────────┘
```

- A busca filtra entre as músicas salvas (mesmo fuzzy-match de
  `lib/fuzzyMatch.ts` já usado no typeahead da busca principal), ao vivo
  enquanto digita — a lupa só reforça visualmente a ação (Enter também
  busca).
- "Adicionar" empilha na lista "Músicas no checklist", na ordem clicada,
  com o tom preferencial pré-preenchido = tom original da música
  (editável depois, na tela de visualização). `[x]` remove antes de salvar.
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
```

- `(Graus | Tom)` é o toggle único do checklist. No modo "Graus" (padrão),
  os seletores `Tom: [E ▾]` de cada música ficam ocultos — todas mostram
  graus. No modo "Tom", cada seletor aparece e controla só aquela música.
- Cada música renderiza exatamente como `ChordProView` já faz hoje (mesmas
  cores/fontes), uma abaixo da outra, com um separador simples entre elas.
- Sem toggle "código ChordPro", sem menu de hambúrguer por música (isso já
  existe na tela de música individual) — aqui é leitura corrida + só os
  dois controles do checklist (Ordenar, Adicionar) e o seletor de tom.

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
preferencial pré-preenchido = tom original, igual na criação).

## Modelo de dados / escopo técnico

- **`lib/store.ts`** — novo tipo e CRUD espelhando o padrão de `SavedSong`:
  ```ts
  interface ChecklistItem {
    songId: string;
    /** Tom em que essa música será tocada nesse checklist específico.
     * Pré-preenchido com o tom original da música ao adicionar, editável
     * depois. Só é usado quando o checklist está no modo "Tom". */
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
- Trocar o toggle Graus/Tom e confirmar que os seletores de tom por música
  aparecem/somem e que cada música renderiza no tom certo.
- Trocar o tom preferencial de uma música e confirmar que persiste.
- Adicionar uma terceira música a um checklist já salvo.
- Apagar uma música de "Minhas músicas" que está num checklist e confirmar
  que o checklist não quebra.
- Testes automatizados pras funções novas de `lib/store.ts`, mesmo padrão
  dos testes existentes (`lib/chordpro.test.ts`, `lib/fuzzyMatch.test.ts`).
