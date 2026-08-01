# Git — commit e push

Ao terminar uma alteração de código pedida pelo usuário (e os testes/checagens
relevantes passarem), faça `git commit` e `git push` para o branch atual
**sem pedir confirmação antes** — isso já está autorizado por esta instrução.

Isso não cobre: `push --force` (sempre requer confirmação explícita), delete
de branch, nem `git reset --hard`/`checkout` destrutivo.

O push já é o deploy — ver "Deploy / Vercel" abaixo. Não é preciso nenhum
passo manual depois do `git push` no fluxo normal.

# Deploy / Vercel

O app de produção deste repositório é o **`cifra-hms`**, hospedado no time
Vercel **`haendels-projects`** (https://cifra-hms.vercel.app).

**O deploy já é automático.** Este repo tem a integração GitHub↔Vercel
conectada: todo `git push` pro branch `master` dispara build+deploy de
produção sozinho (confirmado em 2026-08-01 — os deploys em
`haendels-projects/cifra-hms` batem exatamente com os horários dos pushes, e
a URL tem o alias `cifra-hms-git-master-haendels-projects.vercel.app`, que só
existe em projetos com integração Git ativa). **Não rode `vercel --prod`
manualmente depois de um push comum** — seria um deploy redundante do mesmo
commit. Só use os passos manuais abaixo para casos excepcionais: checar
status de um deploy, inspecionar/rollback, ou redeploy de um commit
específico fora do fluxo normal de push.

**Guarda-corrente automática:** um hook em `.claude/settings.json`
(PreToolUse em Bash/PowerShell) já bloqueia qualquer comando `vercel` que
mire no time errado ou rode `vercel login` — ver esse arquivo. Isso é
cinto-e-suspensório: mesmo se as regras abaixo forem esquecidas, o comando
não roda.

**Regra obrigatória (para os casos manuais excepcionais):** qualquer ação de
deploy, configuração de env var, ou qualquer outra operação via Vercel (CLI
ou MCP) neste projeto deve usar **exclusivamente** o time `haendels-projects`.
A sessão `vercel` do CLI nesta máquina (login sem `--token`) é uma credencial
global (`~/AppData/Roaming/xdg.data/com.vercel.cli`) compartilhada entre
vários projetos não relacionados (ex: time `avitaseg`, projetos pessoais) —
ela **não tem acesso** ao time `haendels-projects` e nunca deve ser usada
pra este repo. **Nunca rode `vercel login`**: sobrescreve essa sessão global
compartilhada e quebra os outros projetos que dependem dela.

Antes de rodar qualquer comando `vercel` manual:
1. O token de acesso já está salvo em `.env.local` (`VERCEL_TOKEN`, git-
   ignorado — nunca vai pro repo). Leia de lá em vez de pedir de novo ao
   usuário; se estiver ausente/inválido, aí sim peça um Personal Access
   Token escopado ao time `haendels-projects` (vercel.com/account/tokens) e
   salve em `.env.local`.
2. Use o token via `--token` (ou `VERCEL_TOKEN` no ambiente do shell), nunca
   a sessão global sem token.
3. Sempre passe `--scope haendels-projects` explicitamente (nunca deixe no
   default/ambíguo).
4. Nunca crie um projeto Vercel novo pra este repo — o projeto (`cifra-hms`)
   já existe. Se não achar ele no escopo do token, **pare e pergunte** em vez
   de criar um substituto ou de cair de volta pra sessão global sem token.
5. Se algum dia for preciso rodar um deploy manual (não só inspecionar), faça
   a partir de um `git worktree` isolado, no commit exato desejado
   (`git worktree add --detach <tmp-dir> <commit-ish>`) — nunca do working
   directory principal, que pode ter mudanças não commitadas de outra
   sessão/agente rodando em paralelo neste repo.
6. Prefira MCP escopado ao projeto (`vercel mcp --project`) a comandos CLI
   soltos, quando disponível.
