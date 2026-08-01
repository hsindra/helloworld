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

## Decisões já tomadas (a partir do pedido)

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

## Perguntas em aberto — preciso da sua confirmação antes de codar

1. **Checklist guarda referência, não cópia.** O checklist salva os `id`s
   das músicas salvas (como `viewerMeta.id` já faz hoje). Se você editar uma
   música depois, o checklist reflete a versão atual automaticamente; se
   você apagar a música, o checklist mostra "música removida" no lugar dela
   em vez de quebrar. Alternativa seria congelar uma cópia do ChordPro no
   momento de adicionar (aí editar a música original não afetaria o
   checklist). **Confirma referência por id, ou prefere cópia congelada?**
2. **Tom de visualização dentro do checklist:** cada música abre no seu
   padrão ("Graus"), sem seletor de tom por música dentro dessa tela nessa
   primeira versão (evita complexidade — pode virar extensão futura). Ok?
3. **Reordenar com setas ▲▼ por item**, sem arrastar-e-soltar (drag-and-drop
   pediria uma lib nova, que hoje o projeto não tem — ver `package.json`).
   Ok pra v1, ou reordenar por arrastar é essencial pra você?
4. **Apagar:** dá pra apagar um checklist inteiro (na lista de checklists) e
   remover uma música de dentro dele (na tela de ordenar). Confirma que
   isso deve existir já nessa v1?
5. Nome de checklist duplicado é permitido (dois checklists com o mesmo
   nome)? Presumo que sim, já que "Minhas músicas" também não bloqueia
   títulos repetidos.

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
│  │ culto 02/08/26                    3 músicas│ │
│  ├────────────────────────────────────────────┤ │
│  │ culto 26/07/26                    5 músicas│ │
│  ├────────────────────────────────────────────┤ │
│  │ ensaio quinta                     2 músicas│ │
│  └────────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

*(estado vazio: "Nenhum checklist criado ainda.", mesmo padrão do estado
vazio de "Minhas músicas")*

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
│  1. Só Tu És Santo                        [x]   │
│  2. Eu Vou Construir                      [x]   │
│                                                  │
│                    [ Salvar checklist ]         │
└────────────────────────────────────────────────┘
```

- A busca filtra entre as músicas salvas (mesmo fuzzy-match de
  `lib/fuzzyMatch.ts` já usado no typeahead da busca principal), ao vivo
  enquanto digita — a lupa só reforça visualmente a ação (Enter também
  busca).
- "Adicionar" empilha na lista "Músicas no checklist", na ordem clicada.
  `[x]` remove antes de salvar.
- "Salvar checklist" fica desabilitado sem nome ou sem nenhuma música.

### 4. Checklist aberto (visualização corrida, somente leitura)

```
┌────────────────────────────────────────────────┐
│  ‹ voltar   culto 02/08/26                      │
│                            [↕ Ordenar] [+ Add.] │
│  ──────────────────────────────────────────────│
│  Só Tu És Santo                                 │
│  Diante do Trono                                │
│                                                  │
│    1          4         1                       │
│  Só tu és santo, só tu és digno de adoração     │
│    ...                                          │
│                                                  │
│  ──────────────────────────────────────────────│
│  Eu Vou Construir                               │
│  Aline Barros                                   │
│                                                  │
│    1      5m       4                            │
│  Eu vou construir, com a palavra que ouvi       │
│    ...                                          │
│                                                  │
└────────────────────────────────────────────────┘
```

- Cada música renderiza exatamente como `ChordProView` já faz hoje (mesmas
  cores/fontes), uma abaixo da outra, com um separador simples entre elas.
- Sem toggle "código ChordPro", sem menu de opções por música (isso já
  existe na tela de música individual) — aqui é só leitura corrida.
- "Ordenar" e "Adicionar" ficam no topo, ao lado do nome do checklist.

### 5. Ordenar músicas do checklist

```
┌────────────────────────────────────────────────┐
│  ‹ voltar   Ordenar — culto 02/08/26            │
│                                                  │
│  1. Só Tu És Santo                    [▲] [▼]   │
│  2. Eu Vou Construir                  [▲] [▼]   │
│  3. Ninguém Explica Deus              [▲] [▼]   │
│                                                  │
│                    [ Concluir ]                 │
└────────────────────────────────────────────────┘
```

### 6. Adicionar música a um checklist existente

Reaproveita a mesma UI de busca+adicionar da tela de criação (seção 3),
aberta como uma tela/painel sobre o checklist já salvo — sem precisar
recriar nada, só acrescenta músicas ao array existente.

## Modelo de dados / escopo técnico (rascunho, sujeito às respostas acima)

- **`lib/store.ts`** — novo tipo e CRUD espelhando o padrão de `SavedSong`:
  ```ts
  interface Checklist {
    id: string;
    name: string;
    songIds: string[]; // ordem = ordem de exibição
    createdAt: number;
  }
  ```
  `CHECKLIST_INDEX_KEY = 'checklists:index'`, chave `checklist:{id}`, mesmas
  funções (`saveChecklist`, `listChecklists`, `getChecklist`,
  `deleteChecklist`) no mesmo estilo de `saveSong`/`listSongs`/etc.
- **`app/api/checklists/route.ts`** — `GET` (lista) / `POST` (cria, recebe
  `name` + `songIds`).
- **`app/api/checklists/[id]/route.ts`** — `GET` (detalhe, já resolvendo os
  `songIds` pra `SavedSong[]` via `getSong`, ignorando ids não encontrados)
  / `PUT` (renomear, reordenar, adicionar/remover música — um único body
  com o array `songIds` final é suficiente) / `DELETE`.
- **`app/page.tsx`** — estender `Mode` para incluir `'checklists'`; estado
  novo pro checklist aberto (`openChecklist`) e pro modo de construção/edição
  (nome + busca + lista temporária antes de salvar); a busca de músicas
  salvas reaproveita `savedSongs` (já carregado) + `songMatchScore`.
- **Novo componente `app/ChecklistView.tsx`** — recebe a lista de
  `SavedSong` do checklist (na ordem) e renderiza um `ChordProView` por
  música com um separador, reaproveitando o componente existente sem
  duplicar a lógica de parsing/exibição.

## Casos de borda

- Checklist com 0 músicas — permite salvar? Provável que sim, mostrando
  estado vazio ("Nenhuma música neste checklist ainda — toque em
  Adicionar.") na tela de visualização.
- Música referenciada no checklist foi apagada de "Minhas músicas" depois —
  mostrar um espaço reservado ("Música removida") no lugar dela, sem quebrar
  o restante do checklist.
- Busca sem resultado nenhum na tela de criar/adicionar.
- Adicionar a mesma música duas vezes no mesmo checklist — permitir ou
  bloquear? (a confirmar; padrão sugerido: permitir, já que pode fazer
  sentido repetir uma música num culto).
- Nome do checklist vazio — bloqueia "Salvar checklist".

## Verificação

- Criar o checklist do exemplo ("culto 02/08/26" com Só Tu És Santo + Eu Vou
  Construir) e confirmar que aparece na lista, na ordem certa ao abrir.
- Reordenar e confirmar que persiste após recarregar a página.
- Adicionar uma terceira música a um checklist já salvo.
- Apagar uma música de "Minhas músicas" que está num checklist e confirmar
  que o checklist não quebra.
- Testes automatizados pras funções novas de `lib/store.ts`, mesmo padrão
  dos testes existentes (`lib/chordpro.test.ts`, `lib/fuzzyMatch.test.ts`).
