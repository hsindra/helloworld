# Git — commit e push

Ao terminar uma alteração de código pedida pelo usuário (e os testes/checagens
relevantes passarem), faça `git commit` e `git push` para o branch atual
**sem pedir confirmação antes** — isso já está autorizado por esta instrução.

Isso não cobre: `push --force` (sempre requer confirmação explícita), delete
de branch, nem `git reset --hard`/`checkout` destrutivo.

Após o push, faça também o deploy em produção (ver regra "Deploy / Vercel"
abaixo) — sem pedir confirmação antes, seguindo sempre o checklist de
segurança de escopo descrito lá.

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

**Deploy automático:** após dar push de uma alteração terminada, rode o
deploy de produção (`vercel --prod --scope haendels-projects` ou o MCP
escopado ao projeto) **sem pedir confirmação antes** — desde que o checklist
abaixo passe. Se qualquer item do checklist falhar (time errado, projeto não
encontrado no escopo, etc.), **pare e pergunte** em vez de prosseguir ou
tentar contornar.

**A sessão global do CLI (`vercel whoami`) NÃO serve pra este repo.** Ela
loga como a conta pessoal `haendelsindra-3278`, compartilhada com projetos
não relacionados (time `avitaseg`, projetos pessoais) — essa conta não tem
acesso ao time `haendels-projects` e nunca vai aparecer em `vercel teams ls`
rodado sem token. **Nunca rode `vercel login`** pra tentar trocar isso: ele
sobrescreve a sessão global compartilhada e quebra os outros projetos que
dependem dela.

Antes de rodar qualquer comando `vercel`:
1. Peça ao usuário um Personal Access Token da Vercel escopado ao time
   `haendels-projects` (gerado em vercel.com/account/tokens). Não é salvo em
   lugar nenhum persistente — normal pedir de novo em cada sessão, a menos
   que o usuário diga o contrário.
2. Use esse token só nesta sessão, via `--token` (ou `VERCEL_TOKEN` no
   ambiente do shell atual, nunca em arquivo).
3. Confirme com `vercel whoami --token <token>` / `vercel teams ls --token
   <token>` que ele realmente tem acesso ao time `haendels-projects`.
4. Sempre passe `--scope haendels-projects` explicitamente (nunca deixe no
   default/ambíguo).
5. Nunca crie um projeto Vercel novo pra este repo — o projeto (`cifra-hms`)
   já existe. Se não achar ele no escopo do token, **pare e pergunte** em vez
   de criar um substituto ou de cair de volta pra sessão global sem token.
6. Deploy roda a partir de um `git worktree` isolado, no commit exato que
   acabou de ser enviado (`git worktree add --detach <tmp-dir> <commit-ish>`)
   — nunca do working directory principal, que pode ter mudanças não
   commitadas de outra sessão/agente rodando em paralelo neste repo.
7. Prefira MCP escopado ao projeto (`vercel mcp --project`) a comandos CLI
   soltos, quando disponível.
