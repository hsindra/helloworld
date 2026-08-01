# Deploy / Vercel

O app de produção deste repositório é o **`cifra-hms`**, hospedado no time
Vercel **`haendels-projects`** (https://cifra-hms.vercel.app).

**Regra obrigatória:** qualquer ação de deploy, configuração de env var, ou
qualquer outra operação via Vercel (CLI ou MCP) neste projeto deve usar
**exclusivamente** o time `haendels-projects`. A sessão `vercel` do CLI nesta
máquina é uma credencial global (`~/AppData/Roaming/xdg.data/com.vercel.cli`)
compartilhada entre vários projetos não relacionados (ex: time `avitaseg`,
projetos pessoais). Usar essa credencial sem confirmar o escopo correto pode
vazar/afetar projetos de terceiros que nada têm a ver com este repositório.

Antes de rodar qualquer comando `vercel`:
1. Confirme com `vercel whoami` / `vercel teams ls` que a sessão ativa tem
   acesso ao time `haendels-projects`.
2. Sempre passe `--scope haendels-projects` explicitamente (nunca deixe no
   default/ambíguo).
3. Nunca crie um projeto Vercel novo pra este repo — o projeto (`cifra-hms`)
   já existe. Se não achar ele no escopo ativo, **pare e pergunte** em vez de
   criar um substituto.
4. Prefira MCP escopado ao projeto (`vercel mcp --project`) a comandos CLI
   soltos, quando disponível.
