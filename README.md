# Production Readiness Auditor

A skill for [opencode](https://opencode.ai) that audits codebases for production readiness with the rigor of a Staff Engineer, SRE, and Tech Lead.

## Benchmark Results

A/B comparison: same prompts tested **without** the skill (baseline) vs **with** the skill loaded.

### Test 1: Express.js API Review

A minimal Express API with SQL injection, hardcoded credentials, missing body parser, and broken error handling.

| Dimension | Baseline (no skill) | With Skill |
|---|---|---|
| Issues found | 18 | 14 |
| Severity classification | None (natural language) | BLOCKER / HIGH / MEDIUM / LOW |
| Executive summary | No | Yes (score, risk, verdict) |
| Priority recommendations | No (implicit) | Yes (top 5 ranked) |
| Final verdict | No | Yes (✅ / ⚠️ / ❌) |
| Missed issues | Health checks, timeouts, CI/CD | — (all covered) |
| Format | Free-form paragraphs | Structured sections |

**Key difference**: Both found SQL injection, hardcoded creds, and `throw err` crashes. With-skill added severity ranking, executive summary, and a clear "NOT APPROVED" verdict — actionable output for decision-makers.

### Test 2: Dockerfile Review

A Node.js Dockerfile with hardcoded password, floating `node:latest`, root user, and poor caching.

| Dimension | Baseline (no skill) | With Skill |
|---|---|---|
| Issues found | 8 | 9 |
| Severity classification | None | BLOCKER / HIGH / MEDIUM / LOW |
| Executive summary | No | Yes (score 2/10) |
| Multi-stage build | Not mentioned | Flagged as LOW |
| `.dockerignore` | Not mentioned | Flagged as HIGH |
| Graceful shutdown | Mentioned briefly | Detailed with `tini` fix |
| Final verdict | Implicit ("not ready") | Explicit ❌ NOT APPROVED |

**Key difference**: With-skill caught `.dockerignore` and multi-stage build (missed by baseline), and provided concrete fix snippets for each issue.

### Score Comparison

| Metric | Baseline | With Skill |
|---|---|---|
| Average issues found per test | 13 | 11.5 |
| Issues with severity classification | 0% | 100% |
| Issues with concrete fix guidance | ~60% | ~100% |
| Executive summary included | 0% | 100% |
| Final verdict included | 0% | 100% |
| Docker-specific findings | 8 | 9 |
| Production operations findings | 1 | 2 |

### Verdict

The skill significantly improves output quality:
- **Structured format** — Executive summary, severity, prioritized fixes, and final verdict make results immediately actionable
- **Fewer missed issues** — The skill's checklist-style analysis areas (9 categories) prevent overlooking important concerns like graceful shutdown, health checks, and `.dockerignore`
- **Clear go/no-go decision** — Without the skill, reviews are informative but don't answer "can we deploy?" decisively
- **Fix guidance** — With-skill consistently provided concrete code fixes alongside issue descriptions

## Running the Benchmark

```powershell
# Load skill
opencode --skill production-readiness-auditor

# Feed a test prompt
"I need to deploy this Express API to production..."
```

Or use with [opencode](https://opencode.ai) for automated code reviews during CI.
