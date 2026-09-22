# History Runtime

`history` persists Inspiration research history in project-local SQLite state.

Source: `history/history.mjs`  
Release executable: `bin/history` or `bin/history.exe`

## Project state

Initialize a project with:

```text
history init [--path <project>]
```

This creates:

```text
.inspiration/
├── project.json
└── research.db
```

If `--path` is omitted, the current directory is used. Access `research.db` through the CLI rather than editing it directly.

## Commands

```text
history init [--path <project>]
history get <url> [--track visual|product] [--path <project>]
history write <url> --track visual|product --stage <stage> [options]
history search [text] [filters]
```

Run `history --help`, `history help <command>`, or `history <command> --help` for the complete CLI reference.

### `get`

`get` is read-only. It canonicalizes the URL and reports three levels of prior history:

- `exact_seen`: the canonical URL has a stored record.
- `route_seen`: another stored URL matches the same conservative route family.
- `domain_seen`: another stored URL exists on the same site.

Route-family matching recognizes numeric IDs, UUIDs, long hexadecimal IDs, numbered page segments, and common numeric pagination parameters. Related URLs never count as exact visits.

### `write`

`write` records activity for one URL.

Stages:

- `discovered`: found as a candidate.
- `visited`: materially inspected.
- `captured`: saved evidence was captured. Requires `--artifact`.
- `inspected`: a source or registered artifact was inspected.
- `accepted`: accepted by the researcher or auditor.
- `rejected`: rejected by the researcher or auditor.

Options:

```text
--actor researcher|auditor
--artifact <file>
--note <text>
--path <project>
```

`--actor` defaults to `researcher`. Auditors may record only `inspected`, `accepted`, or `rejected`.

Artifact-level judgments require the artifact to have already been registered with `captured`. Captured files are SHA-256 hashed so duplicate evidence can be detected across sources.

### `search`

`search` queries recorded URLs, domains, notes, and artifact paths. Search text is optional.

Filters:

```text
--track visual|product
--verdict accepted|rejected|pending
--domain <domain>
--limit <n>
--path <project>
```

Examples:

```text
history search "navigation hierarchy" --track visual
history search --domain duolingo.com --limit 20
history search --verdict pending --track product
```
