# Development Process

## Overview

We use GitHub Issues to track development of the DataTasks platform. All work is tracked as issues with labels — no project boards. Four agents handle the full lifecycle from raw request to shipped code.

## Links

- Repo: https://github.com/alexeygrigorev/datatasks
- Issues: https://github.com/alexeygrigorev/datatasks/issues
- Specs: [`docs/specs.md`](../docs/specs.md)

## Issue Lifecycle

```
User creates issue     →  PM grooms        →  Engineer builds  →  Tester verifies  →  PM accepts  →  Ship
(needs grooming)          (spec + tests)       (code + tests)     (runs all tests)    (user POV)     (commit + push)
```

1. User creates an issue via the GitHub issue template. It gets the `needs grooming` label automatically.
2. Product Manager reads the raw request, researches the codebase, and rewrites the issue with: scope, acceptance criteria, dependencies, and test scenarios. Removes `needs grooming`, adds proper labels.
3. Software Engineer implements the groomed issue — writes code and tests locally. Does NOT commit.
4. Tester reviews the code, runs ALL tests, verifies every acceptance criterion. Reports pass/fail.
5. Product Manager does final acceptance review from the user's perspective — checks user flow, copy, empty states, navigation, consistency. Reports accept/reject.
6. Software Engineer commits and pushes with `Closes #N`.
7. On-Call Engineer monitors CI/CD and fixes any breakages.

## Agents

| Agent | File | Role |
|-------|------|------|
| Product Manager | `.claude/agents/product-manager.md` | Grooms issues into specs (start) + user acceptance review (end) |
| Software Engineer | `.claude/agents/software-engineer.md` | Implements code + tests, does NOT commit until approved |
| Tester | `.claude/agents/tester.md` | Runs all tests, verifies acceptance criteria technically |
| On-Call Engineer | `.claude/agents/oncall-engineer.md` | Monitors CI/CD after push, fixes failures |

## Agent Workflow

An orchestrator (human or top-level Claude Code session) drives the process:

```
User creates issue (needs grooming)
    │
    ▼
Product Manager ──► grooms into agent-ready spec
    │
    ▼
Orchestrator picks groomed issue
    │
    ├── assigns issue ──► Software Engineer ──► writes code + tests
    │                          │
    │                          ▼
    ├── sends to review ──► Tester ──► reviews code, runs all tests
    │                          │
    │                          ▼
    │                     feedback (pass / fail with specifics)
    │                          │
    │         ┌────────────────┘
    │         ▼
    ├── if fail ──► Software Engineer fixes ──► Tester re-reviews
    │                    (repeat until pass)
    │
    ├── if tester passes ──► Product Manager ──► acceptance review (user perspective)
    │                              │
    │                              ▼
    │                         accept / reject
    │                              │
    │         ┌────────────────────┘
    │         ▼
    ├── if reject ──► Software Engineer fixes ──► Product Manager re-reviews
    │
    ├── if accept ──► Software Engineer commits and pushes
    │
    └── On-Call Engineer ──► monitors CI/CD, fixes if broken
```

### Detailed Steps

1. User creates a raw issue via the GitHub template (auto-labeled `needs grooming`)
2. Product Manager grooms it: scope, acceptance criteria, test scenarios, dependencies, labels
3. Orchestrator picks a groomed issue and assigns it to the software engineer
4. Software engineer reads the issue, writes code and tests locally (does NOT commit)
5. Tester reviews the code, runs all tests, reports pass/fail
6. If tester fails: specific feedback → software engineer fixes → tester re-reviews (repeat)
7. If tester passes: Product Manager does acceptance review from user perspective
8. If PM rejects: specific UX feedback → software engineer fixes → PM re-reviews
9. If PM accepts: software engineer commits and pushes with `Closes #N`
10. Pipeline fixer checks CI/CD and fixes any failures

### Orchestrator Responsibilities

- Groom any `needs grooming` issues first (launch product-manager in grooming mode)
- Pick the next groomed issues (2 at a time, in parallel when independent)
- Launch software engineer with the issue number
- When software engineer reports done, launch tester
- If tester fails: relay feedback to software engineer, re-launch to fix, then re-launch tester
- If tester passes: launch product manager for acceptance review
- If PM rejects: relay UX feedback to software engineer, fix, then re-launch PM
- If PM accepts: tell software engineer to commit and push
- After pushing, run oncall-engineer to check CI/CD
- After committing, pick the next two issues (never stop until all issues are done)
- Tester must actually run all tests — not just review code

### How to Pick Issues

1. `gh issue list --repo alexeygrigorev/datatasks --state open --limit 50 --json number,title,labels --jq 'sort_by(.number) | .[] | "#\(.number) \(.title) [\(.labels | map(.name) | join(", "))]"'`
2. Skip issues labeled `needs grooming` — they haven't been groomed yet
3. Pick the lowest-numbered open groomed issues first (lower = more foundational)
4. Check the issue's Depends on field — don't start until dependencies are closed
5. Skip issues whose dependencies are still open
6. Pick 2 independent issues at a time and run them in parallel

### Continuous Issue Pipeline

Always keep the pipeline full. When starting a batch, immediately add a "Pick next two issues" task blocked by the current batch. This ensures work never stops.

```
Batch N: implement + test + accept → commit + push
    └── triggers: "Pick next two issues" → Batch N+1 → ...
```

### Human Verification

Some acceptance criteria are marked `[HUMAN]` in issues (OAuth flows, visual checks). When an issue passes all agent reviews but has `[HUMAN]` criteria:

1. Commit and push the code (don't block on human verification)
2. Add the `human` label: `gh issue edit N --repo alexeygrigorev/datatasks --add-label human`
3. Comment listing criteria that need manual verification
4. Do NOT close the issue — leave it open for the human to verify and close
5. Continue with the next issues (don't wait)

## Labels

| Category | Labels |
|----------|--------|
| Workflow | `needs grooming` |
| Area | `frontend`, `backend`, `api`, `database`, `infra`, `integration` |
| Priority | `P0` (must have), `P1` (important), `P2` (nice to have) |
| Special | `human` (code done, needs manual verification) |

## Technology Stack

- Backend: AWS Lambda (JavaScript/Node.js)
- Database: DynamoDB
- Frontend: Single Page Application (SPA) with vanilla JavaScript (no React)
- Deployment: Fully serverless (Lambda + DynamoDB)
- Local dev: Local DynamoDB alternative (SQLite-like)
- Testing: Local + integration tests via Docker
