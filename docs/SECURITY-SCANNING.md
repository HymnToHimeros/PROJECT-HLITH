# Security scanning (CodeQL) on your own machine

GitHub's code scanning runs CodeQL's default query suites on main. To see the same alerts before
you push, run CodeQL locally. You need about 2 GB of free disk space and network access to github.com
(release downloads).

## 1. Get CodeQL (once)

```sh
mkdir -p ~/codeql-home && cd ~/codeql-home
curl -L -o codeql-bundle.tar.gz https://github.com/github/codeql-action/releases/latest/download/codeql-bundle-linux64.tar.gz
tar xzf codeql-bundle.tar.gz          # → ~/codeql-home/codeql/codeql
```

On a Mac use `codeql-bundle-osx64.tar.gz`. The bundle already holds the query packs, so it needs nothing else.

## 2. Scan (from the repo root)

```sh
CQ=~/codeql-home/codeql/codeql
$CQ database create ../hlith-db --db-cluster --language=javascript-typescript,actions --source-root=. --overwrite
$CQ database analyze ../hlith-db/javascript \
  codeql/javascript-queries:codeql-suites/javascript-code-scanning.qls \
  --format=sarif-latest --output=../hlith-js.sarif
$CQ database analyze ../hlith-db/actions \
  codeql/actions-queries:codeql-suites/actions-code-scanning.qls \
  --format=sarif-latest --output=../hlith-actions.sarif
```

These are the same suites as GitHub's default setup (`javascript-code-scanning`, `actions-code-scanning`).

## 3. Read the result

```sh
node -e '
for (const f of process.argv.slice(1)) {
  const runs = JSON.parse(require("fs").readFileSync(f, "utf8")).runs;
  for (const r of runs) for (const x of r.results) {
    const l = x.locations[0].physicalLocation;
    console.log(`${x.ruleId}  ${l.artifactLocation.uri}:${l.region.startLine}`);
  }
}' ../hlith-js.sarif ../hlith-actions.sarif | sort | uniq -c
```

No lines means no alerts. Keep the database and SARIF files outside the repo (they are large).

## Fixing common alerts

- **Incomplete multi-character sanitization**: don't write a one-pass `.replace(/<[^>]+>/g, '')`. Use
  `stripTags`, `stripComments` or `unwrapComments` from `src/core/text/markup.ts` (they repeat until nothing is left).
- **Clear text storage of sensitive information**: never put a login, token or key into `localStorage` as is.
  Use `seal` / `unseal` from `src/core/data/deviceVault.ts` (see the HoYoLAB device storage in
  `src/tools/account-links/hoyolab.ts`).
