---
name: execute
description: Run the full development loop - pick issues, implement, QA, PM review, commit, push, repeat.
disable-model-invocation: true
argument-hint: [number-of-issues]
---

# Execute Development Loop

Run the full issue pipeline. Number of issues per batch: $ARGUMENTS (default: 2)

## Step 1: Pick Issues

```bash
gh issue list --repo alexeygrigorev/datatasks --state open --limit 50 --json number,title,labels --jq 'sort_by(.number) | .[] | "#\(.number) \(.title) [\(.labels | map(.name) | join(", "))]"'
```

Rules:
- Skip issues labeled `needs grooming` (groom them first with PM agent)
- Skip issues labeled `human` (waiting for manual verification)
- Pick the lowest-numbered issues first (lower = more foundational)
- Check `Depends on` field — don't start until dependencies are closed
- If no actionable issues remain, report "No actionable issues" and stop

## Step 1b: Create Todo List

After picking issues, create a todo list with dependencies:

1. "Implement #N (Title)" — one per issue, status: in_progress
2. "QA #N (Title)" — blocked by the implement task
3. "PM Review #N (Title)" — blocked by QA (features only)
4. "Commit and push batch" — blocked by all review tasks
5. "Pick next batch" — blocked by the commit task

## Step 2: Implement (parallel)

Launch engineers in parallel for each picked issue:

```
Task(subagent_type="implementer", model="opus", prompt="Implement issue #N. Read the issue with gh issue view N --repo alexeygrigorev/datatasks. Read docs/specs.md and docs/PROCESS.md first. Follow the spec and acceptance criteria. Write code, unit tests, AND Playwright E2E tests in e2e/*.spec.js. Run npx playwright test and verify all E2E tests pass. Do NOT commit.")
```

## Step 3: QA (parallel)

For each completed implementation, launch a tester agent:

```
Task(subagent_type="qa", model="opus", prompt="QA issue #N. Read docs/specs.md and docs/PROCESS.md first. The engineer wrote {description}. Review the code, run ALL tests (npm test AND npx playwright test). Verify Playwright E2E tests exist in e2e/*.spec.js covering the issue's BDD scenarios. FAIL if E2E tests are missing. Report pass/fail with specifics.")
```

## Step 4: Handle QA Results

- If QA PASSES: proceed to PM review (for features) or commit
- If QA FAILS: relay feedback to engineer, re-implement, re-QA (max 2 retries)
- If QA fails after 2 retries: skip the issue, report it

## Step 5: PM Acceptance Review (features only)

```
Task(subagent_type="general-purpose", model="opus", prompt="You are the Product Manager agent doing acceptance review for issue #N. Read docs/specs.md first. Read .claude/agents/product-manager.md for your review checklist. CRITICAL: Reject if Playwright E2E tests are missing or don't cover the issue's BDD test scenarios. Check e2e/*.spec.js files. Report ACCEPT or REJECT with specifics.")
```

## Step 6: Handle PM Results

- If PM ACCEPTS: proceed to commit
- If PM REJECTS: relay feedback to engineer, fix, re-run PM review (max 2 retries)

## Step 7: Commit and Push

```bash
git add {specific files}
git commit -m "$(cat <<'EOF'
Short description

Closes #N
EOF
)"
git push origin main
```

## Step 8: Pipeline Check

```bash
sleep 10
gh run list --repo alexeygrigorev/datatasks --limit 3
```

If a run fails, launch the oncall-engineer agent to fix it.

## Step 9: Repeat

Go back to Step 1 and pick the next batch. Never stop until all open issues are done or no actionable issues remain.

## Summary Format

After each batch:

```
## Batch N Complete

| Issue | Type | Engineer | QA | PM | Status |
|-------|------|----------|----|----|--------|
| #X Title | Feature | DONE | PASS | ACCEPT | Committed (abc1234) |

Next: picking issues for batch N+1...
```
