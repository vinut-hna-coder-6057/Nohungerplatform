# NoHunger pre-push readiness report

**Review date:** 2026-10-20
**Decision:** NOT READY
**Repository root:** `Nohungerplatform`
**Application directory:** `Nohunger/`

## Files changed

- Repository root: `.github/workflows/ci.yml`.
- Application: `.env.example`, `.nvmrc`, `PRODUCTION_READINESS_REPORT.md`, `config/multer.js`, `controllers/notificationController.js`, `controllers/requestStatusController.js`, `models/Notification.js`, `package.json`, `package-lock.json`, `public/index.html`, `routes/apiRoutes.js`, `scripts/check-js-syntax.js`, `socket/index.js`, `tests/requestStatus.integration.test.js`, and `tests/requestStatus.test.js`.

## Changes in this review

- Added `.nvmrc` and the package `engines` constraint for Node 22.23.3; the root CI workflow now selects that version.
- Documented in `.env.example` that request lifecycle transactions require a replica set or sharded MongoDB deployment.
- Replaced Nodemon with Node's built-in `--watch` in the development script. The supported Nodemon line pulled a high-severity `chokidar → braces` chain; removing that dependency removed all current high findings from the full dependency audit.
- Added MongoDB transaction integration tests for successful completion, rollback after participant validation fails, concurrent receiver claims, and concurrent duplicate completion. The tests refuse any `MONGO_TEST_URI` except local `localhost`/`127.0.0.1` database `nohunger_test`.
- Updated the root CI workflow to start a disposable MongoDB 7 replica set, run syntax checks, run the production dependency audit, and execute the complete Jest suite with the integration URI configured.
- Earlier working-tree changes remain: participant and state authorization for request transitions, persisted receiver ownership, transactional notification/counter changes, Socket.IO room authorization, upload filename generation with `crypto.randomUUID`, Helmet/Jest/Supertest declarations, dependency updates, and removal of duplicate frontend initialization.

## Environment diagnosis and commands

Node itself and PATH work, but Node cannot resolve JavaScript entry-point paths under the restricted user directory:

| Command | Result |
|---|---|
| `node --version` | `v20.20.0`, exit 0. |
| `npm --version` | `10.8.2`, exit 0. |
| `where.exe node` | `C:\Program Files\nodejs\node.exe`. |
| `where.exe npm` | `C:\Program Files\nodejs\npm` and `npm.cmd`. |
| `node -p "process.execPath"` | `C:\Program Files\nodejs\node.exe`, exit 0. |
| `node -e "console.log('node eval ok')"` | Succeeded, exit 0. |
| `npm run` | Succeeded, listing the configured scripts. |
| `npm test -- --ci` | Exit 1 before Jest loads: `EPERM: operation not permitted, lstat 'C:\Users\vinut'`. **Assertions executed: 0.** |
| `npm run check:syntax` | Exit 1 before the script loads with the same `EPERM`. **Syntax files checked by this command: 0.** |
| `Get-Acl C:\Users\vinut` | `UnauthorizedAccessException`. No ACL or security setting was changed. |

The evidence points to a filesystem/security boundary on entry-point resolution through `C:\Users\vinut`; Node's installation and PATH are functioning. This is a diagnosis from the observed failures, not proof of the specific Windows policy that denies access. Node 22.23.3 is available as an official LTS release, but is not installed in this environment.[Node.js 22.23.3 release](https://nodejs.org/en/blog/release/v22.23.3)

`npm ci` was not run because the Node script execution blocker persists. The non-mutating `npm ci --dry-run --ignore-scripts --offline` passed with exit 0 after manifest and lockfile updates. It validates lock consistency, not a clean install or native module build.

## Verification results

| Check | Result |
|---|---|
| `npm audit --omit=dev --json` | **PASS**, exit 0, 0 production findings. |
| `npm audit --json` | **Findings**, exit 1, 19 moderate, 0 high, 0 critical. |
| `npm audit --audit-level=high` | Exit 0; the report still prints all 19 moderate findings, while high and critical findings fail CI. |
| `npm ci --dry-run --ignore-scripts --offline` | **PASS**, exit 0; manifest/lockfile pair accepted. |
| `git diff --check` | **PASS**, exit 0. |
| Jest suite | **BLOCKED**, exit 1 before Jest starts; no tests ran. |
| Syntax-check script | **BLOCKED**, exit 1 before script starts. |
| MongoDB transaction integration | **NOT RUN** locally. A listener exists on localhost:27017, but its ownership and data isolation were not established; it was not contacted. The integration suite is configured for CI's disposable replica set. |
| GitHub Actions | **NOT RUN**; workflow configuration has not received a GitHub execution result. |
| CD/deployment | **NOT CONFIGURED**; no target or deployment credentials/configuration were found. No deployment occurred. |

## Audit findings and remaining risk

The npm audit metadata retrieved during this review reports **19 moderate findings**, all in development tooling. The actionable advisory is [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), affecting `sprintf-js <=1.1.3` through:

`jest@30.5.2 → @jest/core → @jest/transform → babel-plugin-istanbul@8.0.2 → @istanbuljs/load-nyc-config@1.1.0 → js-yaml@3.15.2 → argparse@1.0.10 → sprintf-js@1.0.3`.

npm does not offer a semver-compatible fix for this installed tree; its suggested root fix downgrades Jest to 25.0.0. That downgrade was rejected. The issue is in test tooling and does not ship under `npm ci --omit=dev`, but it remains a documented development supply-chain risk. The previous Nodemon chain was removed using Node's built-in watch mode, not a transitive override.

Previously reported production advisories were addressed: bcrypt 6 removes the vulnerable `@mapbox/node-pre-gyp → tar` chain, Nodemailer 10.1.7 is outside the audit's affected ranges, Mongoose is at 8.24.5, `proxy-addr` at 2.0.8, and Socket.IO parser at 4.2.7. The vulnerable UUID dependency was removed in favor of Node's `crypto.randomUUID()`. Re-run both audits before release because advisory data changes over time.

## Feature coverage status

No application tests actually ran here. Existing Jest files cover authentication, protected routes, profiles, payload validation, notifications, location, health, admin, routes, and request-status behavior, but source presence is not execution evidence. New request-status unit cases cover eligible acceptance, cross-location denial, donor role denial, missing authentication, invalid/repeated transitions, concurrent receiver claim, notification persistence, and private-room denial. The four Mongo integration cases cover transactional commit, rollback, concurrent claims, and duplicate completion; those are configured to run in CI and remain unverified until CI executes.

| Feature | Status | Evidence / blocker |
|---|---|---|
| Registration, login, logout, protected routes | BLOCKED | Jest did not load because of Node `EPERM`; no auth assertions ran. |
| Profiles and role permissions | BLOCKED | Jest did not load; no profile or permission assertions ran. |
| Donation management and file uploads | BLOCKED | Jest did not load; upload endpoint and file validation were not executed. |
| Request creation, assignment, transitions, completion | BLOCKED | New unit and Mongo integration suites were not executed. |
| Notification persistence and Socket.IO events/authorization | BLOCKED | New tests were not executed against a running app/database. |
| Location saving and map integrations | NOT TESTED | No browser/map-provider session was used; API tests did not run. |
| Admin features and analytics | BLOCKED | Jest did not load; no admin assertions ran. |
| Expiry worker/background jobs | NOT TESTED | Worker was not started against an isolated database. |
| Frontend forms, initialization, API/error flows | NOT TESTED | No browser automation or frontend build script is configured. |
| SMTP/email | NOT TESTED | No SMTP configuration was used and no mail was sent. |

The Mongo listener on port 27017 was not assumed safe or contacted. The deployed `MONGO_URI` topology is unavailable for review; production must use a replica set or sharded MongoDB deployment for the new multi-document transactions. Production services and data were not accessed.

## CI, CD, and release gate

The active workflow is at repository-root `.github/workflows/ci.yml` and runs from `Nohunger/`. It triggers on pull requests and pushes to `main`, uses read-only contents permission, pins Node via `Nohunger/.nvmrc`, installs with `npm ci`, starts an ephemeral MongoDB 7 replica set, runs JavaScript syntax validation and a production audit, displays the full audit while failing on high/critical findings, and runs Jest without `continue-on-error`. No frontend build script exists. No local workflow parser was available; resolving the installed `js-yaml` parser also hit the same Node `EPERM`. The YAML was reviewed manually, but parser validation and GitHub execution remain outstanding.

PowerShell verification from the application directory after resolving the environment restriction:

```powershell
node --version  # must report v22.23.3
npm ci
npm run check:syntax
npm test -- --ci
npm audit --omit=dev
npm audit
git diff --check
```

Record `$LASTEXITCODE` after each command. For local transaction integration, start a disposable MongoDB replica set and set only `MONGO_TEST_URI=mongodb://127.0.0.1:27017/nohunger_test?replicaSet=rs0`; never point it at production. Confirm `.github/workflows/ci.yml` completes successfully in GitHub Actions. CD prerequisites are an explicitly selected deployment target, its approved secret/configuration names, health-check endpoint, and rollback procedure.

**Do not push yet.** Required Jest and syntax checks did not run, Mongo transaction tests have no execution evidence, the deployed MongoDB topology is unconfirmed, and CI has not run on GitHub. The full audit also retains a moderate development-tooling advisory. No commit, push, merge, or deployment was made.

## Latest verification attempt (2026-10-20)

This section records the latest commands from the restricted Windows workspace. It supersedes earlier environment results where they differ.

### Node EPERM diagnosis

Working directory: `C:\Users\vinut\Downloads\Nohungerplatform\Nohunger`.

| Command | Observed result |
|---|---|
| `where.exe node` | `C:\Program Files\nodejs\node.exe`, exit 0. |
| `where.exe npm` | `C:\Program Files\nodejs\npm` and `npm.cmd`, exit 0. |
| `node --version` / `npm --version` | `v20.20.0` / `10.8.2`, both exit 0. |
| `node -p "process.execPath"` | `C:\Program Files\nodejs\node.exe`, exit 0. |
| `node -e "console.log('plain eval ok')"` | Output `plain eval ok`, exit 0. |
| `npm run check:syntax` | Exit 1 before the entry script loads; zero files parsed. |
| `npm test -- --ci` | Exit 1 before Jest loads; zero suites and assertions executed. |

Both failing scripts produce this same Node 20.20.0 stack and error:

```text
Error: EPERM: operation not permitted, lstat 'C:\Users\vinut'
    at Object.realpathSync (node:fs:2741:29)
    at toRealPath (node:internal/modules/helpers:58:13)
    at Module._findPath (node:internal/modules/cjs/loader:740:22)
    at resolveMainPath (node:internal/modules/run_main:168:19)
    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:34:12)
Node.js v20.20.0
```

Plain `node -e` works, but resolving a script entry point requires `realpath`/`lstat` through the parent `C:\Users\vinut`, where the process receives EPERM. This isolates the observed failure to filesystem access during entry-point resolution; it does not identify the exact Windows policy. No permission, ACL, or security control was changed. Node 22.23.3 is not installed and no version manager is available on PATH or in the checked standard install directory. The repository pin is `.nvmrc`. Install/activate the official Windows x64 Node 22.23.3 MSI only through the organization's approved software channel; its official artifact is listed on the [Node.js 22.23.3 release page](https://nodejs.org/en/blog/release/v22.23.3). Switching Node versions alone may not fix the parent-path EPERM and must be followed by the checks below.

### Latest permitted checks

| Command | Result |
|---|---|
| `npm ls --depth=0` | Exit 0. Installed direct versions: bcrypt 6.0.0, cors 2.8.6, dotenv 16.6.1, express 4.22.3, helmet 8.3.0, Jest 30.5.2, jsonwebtoken 9.0.2, mongoose 8.24.5, multer 1.4.5-lts.2, Nodemailer 10.1.7, Socket.IO client 4.8.3, Socket.IO 4.8.3, Supertest 7.3.1. |
| `npm ls --package-lock-only --depth=0` | Exit 0; locked direct tree matches the installed direct tree. |
| `npm explain sprintf-js` | Exit 0; exact development dependency path is recorded below. |
| `npm ci --dry-run --ignore-scripts --offline` | Exit 0, with `EBADENGINE` because this process is Node 20.20.0 and the package requires exactly 22.23.3. This is not a clean install. |
| `npm audit --omit=dev --json` | Exit 1 because the npm audit endpoint at `registry.npmjs.org` could not be reached; current production count is **not refreshed**. |
| `npm audit --json` | Exit 1 for the same registry failure; current full audit count is **not refreshed**. |
| `git diff --check` | Exit 0. |
| Secret-marker scan on changed files | Exit 0; matches were only `.env.example` placeholders and the test-only JWT fixture. No credential material was found. |

The last successful npm audit from this review reported 0 production findings and 19 moderate development findings (0 high, 0 critical). The current network failure is not evidence that those counts are unchanged. npm also reported that it could not write logs under `C:\Users\vinut\AppData\Local\npm-cache\_logs`; no cache or security configuration was changed.

### Advisory path and remediation status

`npm explain sprintf-js` confirms the installed `sprintf-js@1.0.3` path:

`jest@30.5.2 -> @jest/core/@jest/transform -> babel-plugin-istanbul@8.0.2 -> @istanbuljs/load-nyc-config@1.1.0 -> js-yaml@3.15.2 -> argparse@1.0.10 -> sprintf-js@1.0.3` (development dependencies only).

[GHSA-hp3w-g68c-fv3c](https://github.com/advisories/ghsa-hp3w-g68c-fv3c) affects `sprintf-js <=1.1.3`; GitHub's advisory lists no patched release. The issue is a denial of service from unbounded precision specifiers. npm's previous suggested root remedy downgraded Jest to 25.0.0, which is a major downgrade and was not applied. No compatible fix is evidenced; the moderate development-tooling advisory remains open. There is no current audit response from npm in this run.

### Test coverage, CI, and remaining blockers

Regression assertions now check that `endSession()` runs when a transaction callback fails and that real MongoDB sessions have `hasEnded === true` after each integration test. Existing request-status tests cover a same-location eligible receiver, unrelated receiver, donor role denial, missing auth, unsupported/missing/repeated transitions, mocked concurrent claims, persisted self-collection notification, and private Socket.IO room denial. Integration tests cover Mongo transaction commit, rollback, concurrent claims/completion, and notification/counter consistency. These tests remain **BLOCKED / NOT TESTED** because Jest cannot load. The unit suite contains 9 cases in the focused file; the Mongo suite contains 4 cases. No total for the full Jest suite can be reported without execution.

The root workflow uses setup-node with `.nvmrc`, `npm ci`, a dedicated MongoDB 7 replica-set container, the syntax checker, production/full dependency audits, and `npm test -- --ci`. GitHub Actions uses fail-fast step behavior and no test step is skipped or marked `continue-on-error`. The workflow could only be inspected manually here: `actionlint` and a local YAML parser were unavailable. GitHub Actions has **NOT RUN**. The local Mongo integration suite has **NOT TESTED**: Node cannot execute Jest, and `docker info` exited 1 because Docker config access was denied at `C:\Users\vinut\.docker\config.json` and access to `npipe:////./pipe/docker_engine` was denied. No connection was made to the unknown listener on port 27017. The report's four integration cases have no transaction execution evidence. No deployment target is configured; CD is **NOT CONFIGURED**.

Run from an approved Node 22.23.3 environment, in the application directory. These commands print the exit status after each step:

```powershell
Set-Location 'C:\Users\vinut\Downloads\Nohungerplatform\Nohunger'
node --version
Write-Output "node exit: $LASTEXITCODE"
npm ci
Write-Output "npm ci exit: $LASTEXITCODE"
npm run check:syntax
Write-Output "syntax exit: $LASTEXITCODE"
npm test -- --ci
Write-Output "jest exit: $LASTEXITCODE"
npm audit --omit=dev
Write-Output "production audit exit: $LASTEXITCODE"
npm audit
Write-Output "full audit exit: $LASTEXITCODE"
git diff --check
Write-Output "diff check exit: $LASTEXITCODE"
```

For Mongo integration, use only a newly started disposable replica set and the test database URI `mongodb://127.0.0.1:<assigned-test-port>/nohunger_test?replicaSet=rs0`; verify that container/process ownership and port before setting `MONGO_TEST_URI`. Never use the existing unknown port 27017 listener or production data.

**Current verdict: NOT READY.** Node 22.23.3 execution, a clean `npm ci`, syntax checks, the full Jest suite, Mongo replica-set integration, a refreshed audit, local workflow parser validation, and a GitHub Actions run all remain outstanding. No commit, push, or deployment was made.

## Email handling follow-up (2026-10-20)

### Implementation review

- `mail.js` creates and caches the Nodemailer transport only on the first valid send attempt. It rejects if either `EMAIL_USER` or `EMAIL_PASS` is absent, rejects incomplete recipient/subject/body arguments before creating the transport, and propagates Nodemailer delivery errors through the returned promise.
- Mail callers are `controllers/authController.js` (welcome email during registration) and `controllers/userController.js` (role activation email). `utils/mail.js` is a compatibility re-export of `mail.js`.
- Both controller callers keep email best effort: registration and role activation return their normal success responses after a delivery failure. Their logs use fixed generic messages and do not include the recipient, SMTP error text, or credentials. No email was sent during this review.
- Added `tests/mail.test.js` with cases for lazy successful delivery, each missing credential, invalid arguments, propagated SMTP failure, and registration continuing after a mocked email failure. The registration case also checks that log output excludes the address and a test secret.

### Verification evidence and blocker

| Command | Exit | Result |
|---|---:|---|
| `node --version` | 0 | `v20.20.0`; this does not meet the repository `.nvmrc` pin of `22.23.3`. |
| `node -e "console.log('node eval ok')"` | 0 | Node eval works. |
| `npm test -- --runInBand tests/mail.test.js` | 1 | Jest did not load; zero tests executed. Node failed resolving the entry point with `EPERM: operation not permitted, lstat 'C:\Users\vinut'`. |
| `npm test -- --ci` | 1 | Full suite did not load; zero tests executed; same Node entry-point `EPERM`. |
| `Get-Acl C:\Users\vinut | Format-List` | 1 | Windows returned `UnauthorizedAccessException`. No permissions or security settings were changed. |

The repeatable failure occurs during Node's `realpath`/`lstat` while resolving the CLI entry point through `C:\Users\vinut`; plain `node -e` does not require that entry-point resolution and succeeds. This localizes the observed failure to access during script resolution but does not identify the specific Windows policy. The focused and full test results are **BLOCKED**, not passes. Rerun them from an approved environment where Node can access the workspace and the pinned version is active. No alternate invocation was used to bypass the filesystem boundary.

No runtime email verification was possible or attempted. SMTP credentials were not provided or used. The email regression tests are authored but currently have no executed test evidence.
