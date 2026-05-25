# Package Manager And Command Detection

Use this before running tests, typecheck, lint, or final checks.

## Prefer explicit project instructions

If `AGENTS.md` names test, typecheck, lint, build, or package-manager
commands, use those commands.

## Otherwise detect by lockfile

| Lockfile | Package manager | Test command |
|----------|-----------------|--------------|
| `pnpm-lock.yaml` | `pnpm` | `pnpm test` |
| `yarn.lock` | `yarn` | `yarn test` |
| `bun.lockb` / `bun.lock` | `bun` | `bun test` |
| `package-lock.json` | `npm` | `npm test` |

If multiple lockfiles exist, stop and ask which package manager to use.

## Script mapping

Read `package.json` scripts and use project scripts when present:

- test: `<pm> test`
- typecheck: `<pm> run typecheck`
- lint: `<pm> run lint`
- build: `<pm> run build`

If a script is missing, do not invent a command. Report the missing
script and continue only if the workflow phase does not require it.

## Focused tests

Prefer focused test syntax documented in `AGENTS.md`. If unclear, run
the full test command.

