# Production Readiness Auditor

A skill for [opencode](https://opencode.ai) that audits codebases for production readiness with the rigor of a Staff Engineer, SRE, and Tech Lead.

## About

This skill lives in `~/.config/opencode/skills/production-readiness-auditor/`. The git repository here (`prod-auditor/`) contains the skill source, benchmark project, and test results.

## Benchmark: Crude API

The test project at `benchmarks/crude-api/` is a deliberately insecure Express.js API with:

- **SQL Injection** in 2 endpoints (`/user/:id` and `/login`) — raw string concatenation
- **Hardcoded secrets** in `.env`, Dockerfile `ENV`, and docker-compose — DB password, Stripe live API key, JWT secret
- **Plaintext password comparison** in SQL query
- **Missing `express.json()`** body parser — `req.body` is always `undefined`
- **Broken auth middleware** — no `return` after `res.send()`, no Bearer prefix stripping
- **No connection pool** — single `mysql.createConnection()`
- **`throw err` in callback** — crashes the process on DB error
- **No graceful shutdown**, no health check probing, no `.dockerignore`, no TLS, no rate limiting
- **Floating tags** (`node:latest`, `mysql:latest`)

>>>

The A/B test below compares the **exact output** of two subagents reviewing this same project — one without the skill (baseline) and one with the skill loaded.

---

## A/B Test Results

### Baseline Output (without skill)

```
=== BASELINE OUTPUT ===

I've reviewed the entire codebase. Here is the full audit:

**1. Hardcoded secrets in multiple locations**

The database password `MinhaSenhaSuperSecreta123!`, the live API key `sk-live-...`, and the JWT secret `segredo` are all hardcoded in the `.env` file, but `.env` is committed — and worse, they are duplicated into the Dockerfile as `ENV` directives and into `docker-compose.yml` as `environment` variables. This means the secrets live in plaintext in the image layers, in Compose config, and in the source tree. Anyone with access to any of these artifacts can connect to the production database, forge JWTs, or hit whatever API that key protects.

**2. SQL injection on every query**

Both routes that hit the database (`/user/:id` and `/login`) concatenate user-controlled input directly into SQL strings without any sanitization or parameterized queries. `req.params.id` is concatenated into `"SELECT * FROM users WHERE id = " + id`. `req.body.username` and `req.body.password` are concatenated into `"SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'"`. An attacker can supply `id=1 OR 1=1` to dump the entire users table, or `username=' OR '1'='1` to bypass authentication entirely.

**3. Plaintext password storage and comparison**

The login route fetches `SELECT * FROM users WHERE username = '...' AND password = '...'` — this means passwords are stored in plaintext in the database and compared directly in the SQL query. There is no hashing, no salting, no bcrypt, no argon2. Passwords must never be stored or compared in plaintext.

**4. No request body parser**

`app.post('/login', ...)` reads `req.body.username` and `req.body.password`, but there is no `express.json()` or `express.urlencoded()` middleware registered. `req.body` will be `undefined` for every request, so `username` and `password` will both be `undefined`, and the interpolated SQL will be `SELECT * FROM users WHERE username = 'undefined' AND password = 'undefined'`. This endpoint is completely non-functional as written.

**5. JWT signs the entire user record**

`jwt.sign({ user: result[0] }, secretKey, ...)` puts the entire user database row into the JWT payload, including the plaintext password. The token is then sent to the client. Anyone who intercepts or decodes the token (JWTs are only signed, not encrypted by default) can read the user's password.

**6. JWT expiry is 7 days**

The token expires in 7 days, which is excessively long for any production system. There are no refresh tokens, no revocation mechanism, no way to invalidate a compromised token before it naturally expires.

**7. Fallback secrets in code**

`const secretKey = process.env.JWT_SECRET || 'fallback-secret'` — if the environment variable is somehow missing, the system degrades to a hardcoded string, silently weakening security rather than crashing. Same pattern for DB credentials: every credential has a hardcoded fallback.

**8. Database connection uses `var` with synchronous-style API**

`mysql.createConnection` creates a single connection (not a pool). In production, this single connection will be exhausted under any real load. The connection error handler merely prints "DB connection error" — it does not crash the process, attempt to reconnect, or set a flag that prevents further queries.

**9. Auth middleware does not return after sending response**

In `authMiddleware`, when the token is missing or invalid, the function calls `res.send("No token")` or `res.send("Invalid token")` but does not return. Execution continues into `next()` or the catch block, and the route handler still runs after the error response has been sent. This means unauthenticated requests reach the route handler and execute database queries.

**10. Dockerfile uses `node:latest`**

Pinning to `node:latest` means every build pulls the latest tag, which can change at any time and break the application or introduce unexpected behavior.

**11. Dockerfile copies everything and then runs `npm install --production`**

`COPY . .` copies the entire build context, including `node_modules`, `.env` files. It should use a `.dockerignore` file.

**12. Dockerfile hardcodes secrets into image layers**

`ENV DB_PASS=MinhaSenhaSuperSecreta123!` and `ENV API_KEY=sk-live-...` embed production secrets directly into the Docker image.

**13. No `.dockerignore`**

There is no `.dockerignore` file, so `.env`, `node_modules`, `.git` will be included in the image.

**14. Docker Compose uses `mysql:latest`**

Same problem — `latest` tag for MySQL means the database version can change unpredictably.

**15. Docker Compose exposes MySQL to the host on port 3306**

Port 3306 exposed to all network interfaces on the host.

**16. No authentication middleware on the login route**

No rate limiting, no brute-force protection, no CAPTCHA, and no logging of failed attempts.

**17. Error handling: `throw err` in a callback**

In the login route, `if (err) throw err;` throws synchronously inside an asynchronous callback. Node.js will crash the process.

**18. No TLS/HTTPS**

All traffic traverses the network in plaintext.

**19. Missing request logging and observability**

No structured logs, no request IDs, no correlation IDs, no metrics.

**20. No input validation**

`req.params.id` is used directly without checking that it is a number.

**21. No CORS configuration**

No `cors()` middleware.

**22. Missing helmet or security headers**

No security-related HTTP headers are set.

**23. No process manager for production**

The `CMD ["node", "server.js"]` starts a single process with no restart mechanism.

**24. No graceful shutdown**

No `process.on('SIGTERM', ...)` or `process.on('SIGINT', ...)` handler.

**25. `var` instead of `const`/`let`**

Every variable declaration uses `var`.

**Summary**: This code is not remotely close to production readiness. It has critical SQL injection vulnerabilities, hardcoded secrets in multiple layers (source, image, compose config), plaintext password storage, a non-functional login endpoint (missing body parser), JWT tokens that leak passwords, and no error handling, validation, or observability.
```

---

### With-Skill Output

```
=== WITH-SKILL OUTPUT ===

### Executive Summary
- **Overall score:** 0.5/10
- **Production ready:** NO
- **Overall risk:** HIGH (immediate data breach + total compromise)
- **Total issues found:** 27

### Issues Found

#### [BLOCKER] SQL Injection in `/user/:id` — string concatenation
Description: `"SELECT * FROM users WHERE id = " + id` allows any attacker to inject SQL.
Impact: Full database read/write/delete. All user records, credentials exfiltrated.
How to reproduce: `curl http://host:3000/user/1 UNION SELECT * FROM mysql.user`
How to fix: Use parameterized queries: `db.execute('SELECT * FROM users WHERE id = ?', [id], ...)`

#### [BLOCKER] SQL Injection in `/login` — string concatenation of username and password
Description: Classic auth bypass injection.
Impact: Attacker logs in as any user without credentials.
How to reproduce: Send `' OR '1'='1` as username.
How to fix: Parameterized queries + bcrypt password hashing.

#### [BLOCKER] Hardcoded Live API Key in `.env` and baked into Docker image
Description: `API_KEY=sk-live-...` is a Stripe live key committed to env and `ENV API_KEY=...` in Dockerfile.
Impact: Immediate credential theft. Anyone can charge real credit cards.
How to fix: Rotate the key NOW. Use Docker secrets or runtime injection.

#### [BLOCKER] Hardcoded DB Password in Docker image layers
Description: `ENV DB_PASS=MinhaSenhaSuperSecreta123!` in Dockerfile.
Impact: Anyone with image access reads production DB password.
How to fix: Remove `ENV` directives with secrets. Use `--env-file` at runtime.

#### [BLOCKER] JWT Secret is trivially guessable ("segredo" = Portuguese for "secret")
Description: `JWT_SECRET=segredo` and fallback `'fallback-secret'`.
Impact: Anyone can forge valid JWTs and impersonate any user.
How to fix: Generate a cryptographically random secret (`openssl rand -hex 64`).

#### [BLOCKER] Auth middleware doesn't block unauthenticated requests (missing `return`)
Description: No `return` after `res.send(...)`. Execution falls through to `next()`.
Impact: Every route passes auth. `/user/:id` endpoint is completely public.
How to reproduce: `curl http://host:3000/user/999` — returns data with no token.
How to fix: `return res.status(401).json(...)`.

#### [BLOCKER] Missing `express.json()` body parser — `req.body` is undefined
Description: POST `/login` accesses `req.body.username` which is always `undefined`.
Impact: Login endpoint is a permanent error. Auth completely broken.
How to fix: Add `app.use(express.json())` before routes.

#### [BLOCKER] `throw err` in database callback crashes the process
Description: `if (err) throw err;` in `/login` handler.
Impact: Any DB query error kills the entire server. Total outage.
How to fix: `if (err) return res.status(500).json({ error: '...' })`

#### [BLOCKER] No graceful shutdown — SIGTERM/SIGINT unhandled
Description: No `process.on('SIGTERM', ...)` handler.
Impact: K8s/Docker kills process immediately. Active connections dropped.
How to fix: Listen for signals, call `server.close()`, `db.end()`, then exit.

#### [BLOCKER] DB connection never closed — resource leak
Description: `db = mysql.createConnection(...)` never closed with `db.end()`.
Impact: Leaks on restart. DB max_connections exceeded over time.
How to fix: Call `db.end()` in shutdown handler. Use `mysql2.createPool()`.

#### [HIGH] Auth header sent directly to `jwt.verify` without stripping "Bearer " prefix
Description: Standard format is `Authorization: Bearer <token>`. Code passes raw header.
Impact: All legitimate users rejected. Auth middleware completely broken.
How to fix: `const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;`

#### [HIGH] `/user/:id` double response on DB failure
Description: No `return` after `res.send("Error")`. Falls through to `res.json(result)`.
Impact: "Cannot set headers after they are sent" crash on every DB error.
How to fix: `if (err) return res.status(500).json({ error: "..." })`

#### [HIGH] Plaintext passwords in database
Description: Login query compares password directly in SQL.
Impact: Every DB dump leaks all user passwords.
How to fix: Hash passwords with bcrypt.

#### [HIGH] `node:latest` tag — unpredictable base image
Description: `FROM node:latest` changes on every build.
Impact: Sudden build failures or behavioral changes.
How to fix: Pin exact version: `FROM node:20.18.1-alpine`

#### [HIGH] `mysql:latest` tag — same issue for DB
Description: Version drifts unexpectedly.
Impact: MySQL upgrades can break queries.
How to fix: Pin version: `image: mysql:8.0.39`

#### [HIGH] No `.dockerignore` — `.env` and secrets included in build context
Description: Secrets leak into image, accessible via `docker history`.
Impact: Secrets compromised.
How to fix: Create `.dockerignore` with `.env`, `node_modules`, `.git`.

#### [HIGH] Running as root in container
Description: App runs as default root user.
Impact: Container breakout gives host root.
How to fix: Add `USER appuser` after creating user.

#### [HIGH] Health endpoint doesn't verify actual service health
Description: `GET /health` returns `{ status: "ok" }` without checking DB.
Impact: Traffic routed to dead pod when DB is down.
How to fix: Add `db.ping()` to health check.

#### [HIGH] No connection pool — single connection shared
Description: `mysql.createConnection()` creates one TCP connection.
Impact: Under any load, requests serialize on single connection.
How to fix: Use `mysql2.createPool({ connectionLimit: 10 })`

#### [MEDIUM] No error status codes on any endpoint — all return 200
Description: `res.send("Error")` omits `.status()`. Default is 200.
Impact: Monitoring can't distinguish errors from success.
How to fix: Add 401, 403, 500 status codes.

#### [MEDIUM] JWT expires in 7 days — excessively long
Description: `{ expiresIn: '7d' }`. No refresh token mechanism.
Impact: Stolen token usable for a week.
How to fix: Use short expiration (15-60 min) with refresh tokens.

#### [MEDIUM] `console.log` — no structured logging
Description: `console.log("Error: " + err)` — no timestamps, severity, correlation IDs.
Impact: Impossible to debug production incidents.
How to fix: Use `pino` or `winston` with structured JSON logging.

#### [MEDIUM] No rate limiting
Description: No rate limiting middleware on any route.
Impact: Login vulnerable to brute force. DDoS amplification.
How to fix: Add `express-rate-limit`.

#### [MEDIUM] No security headers middleware
Description: Missing `helmet` or equivalent.
Impact: Vulnerable to XSS, clickjacking, MIME sniffing.
How to fix: `npm install helmet` and `app.use(helmet())`.

#### [LOW] No CORS configuration
Description: No CORS middleware. Browsers block all cross-origin requests.
Impact: Frontend on different origin cannot call API.
How to fix: Add `cors()` middleware with explicit allowed origins.

#### [LOW] DB host mismatch — `localhost` in .env vs `db` in docker-compose
Description: `.env` has `DB_HOST=localhost` but compose sets `DB_HOST=db`.
Impact: App connects to wrong host in Docker.
How to fix: Remove `.env` defaults or ensure compose env vars override.

#### [LOW] Port 3306 exposed to host
Description: `ports: ["3306:3306"]` exposes MySQL to host network.
Impact: Unnecessary attack surface.
How to fix: Remove ports mapping for db service.

#### [LOW] No database volume — data lost on restart
Description: No `volumes:` mapping for MySQL data dir.
Impact: All data lost on container restart.
How to fix: Add `volumes: - db_data:/var/lib/mysql`

### Positive Points
- .env file exists for configuration (though misused with secrets)
- Auth middleware is attempted (though broken)
- Dockerfile and docker-compose exist (though insecure)
- Health endpoint exists (though superficial)
- `dotenv` and `mysql2` are reasonable choices

### Priority Recommendations
1. **Immediate:** Rotate the Stripe live API key and DB password. They're compromised.
2. **Security rewrite:** parameterized queries, bcrypt for passwords, proper JWT handling with `return` + Bearer stripping.
3. **Fix auth middleware:** missing `return` + missing `express.json()` + missing Bearer prefix stripping = auth doesn't work at all.
4. **Graceful shutdown + error handling:** `process.on('SIGTERM')`, no `throw err` in callbacks.
5. **Docker hardening:** pin versions, `.dockerignore`, non-root user, remove ENV secrets.

### Final Verdict
❌ **NOT APPROVED** — This is the most critical set of production issues in a single codebase. Zero security controls, multiple hardcoded live secrets, authentication that doesn't work, and SQL injection on every query. Deploying this guarantees a complete data breach within minutes. Requires a full rewrite with security-first design.
```

---

## Comparison Table

| Dimension | Baseline (no skill) | With Skill |
|---|---|---|
| Issues found | 25 | 27 |
| Severity classification | None | BLOCKER (10) / HIGH (9) / MEDIUM (4) / LOW (4) |
| Executive summary | No | Yes (score 0.5/10, risk HIGH) |
| Priority recommendations | No | Yes (top 5 ranked) |
| Final verdict | Implicit ("not ready") | Explicit ❌ NOT APPROVED |
| Bearer prefix bug | Missed | Caught (BLOCKER) |
| DB host mismatch (localhost vs db) | Missed | Caught (LOW) |
| Missing DB volume | Missed | Caught (LOW) |
| Health check doesn't probe DB | Missed | Caught (HIGH) |
| Missing error status codes | Missed | Caught (MEDIUM) |
| Each issue has "how to fix" | ~60% | 100% |
| Concrete CLI commands in fix | No | Yes (e.g. `openssl rand -hex 64`) |

## How the A/B Test Was Run

Two subagents were spawned in parallel via opencode's `task` tool:

1. **Baseline**: Prompted with "review this code for production readiness" — natural language, no structure enforced
2. **With skill**: Prompted with the full `SKILL.md` content as system instructions, including severity classification, response format (Executive Summary → Issues Found → Positive Points → Priority Recommendations → Final Verdict), and the 9 analysis areas

Both subagents received the exact same files (`.env`, `server.js`, `Dockerfile`, `docker-compose.yml`, `package.json`) and were asked for a full audit. The outputs above are verbatim — no editing, truncation, or summarization.

## Running the Skill

```powershell
opencode --skill production-readiness-auditor

# Then feed any codebase
"Audit this project for production readiness: [paste code]"
```
