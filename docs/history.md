# History Runtime

```text
history <command> [options]
```

Use `history --help`, `history help <command>`, or `history <command> --help` for exact syntax.

## Commands

| Command | Purpose |
| --- | --- |
| `init [--path <project>]` | Initialize Inspiration research history for a project. |
| `get <url> [--track visual|product] [--path <project>]` | Read prior history for one URL. |
| `write <url> --track visual|product --stage <stage> [options]` | Record research activity or a judgment. |
| `search [text] [filters]` | Search or filter recorded history. |

When `--path` is omitted, the current directory is used.

## Init

`init` creates the runtime-managed project state:

```text
.inspiration/
├── project.json
└── research.db
```

Use the CLI rather than editing `research.db` directly.

## Get

`get` is read-only. It reports:

- `exact_seen`: the canonical URL has a stored record.
- `route_seen`: another stored URL matches the same route family.
- `domain_seen`: another stored URL exists on the same site.

Exact matching canonicalizes URLs before lookup. Fragments and common tracking parameters are removed, default HTTP/HTTPS ports are normalized, and trailing slashes are normalized.

Route matching is intentionally conservative. It recognizes obvious numeric IDs, UUIDs, long hexadecimal IDs, numbered page segments, and common numeric pagination parameters. A route match never counts as an exact visit.

## Write

Stages:

| Stage | Meaning |
| --- | --- |
| `discovered` | Found as a candidate. |
| `visited` | Materially inspected. |
| `captured` | Saved evidence was captured. Requires `--artifact`. |
| `inspected` | A source or registered artifact was inspected. |
| `accepted` | Accepted by the researcher or auditor. |
| `rejected` | Rejected by the researcher or auditor. |

Options:

| Option | Purpose |
| --- | --- |
| `--actor researcher|auditor` | Judgment actor. Defaults to `researcher`. |
| `--artifact <file>` | Register or judge a saved artifact. |
| `--note <text>` | Store concise judgment context. |
| `--path <project>` | Select the project root. |

Auditors may record only `inspected`, `accepted`, or `rejected`. Artifact-level judgments require an artifact already registered with `captured`.

Captured artifacts are SHA-256 hashed so duplicate evidence can be identified across sources.

## Search

`search` checks recorded URLs, domains, notes, and artifact paths. Search text is optional, so filters can be used by themselves.

| Filter | Purpose |
| --- | --- |
| `--track visual|product` | Restrict to one research track. |
| `--verdict accepted|rejected|pending` | Restrict by auditor verdict. |
| `--domain <domain>` | Restrict to one normalized domain. |
| `--limit <n>` | Limit results. Default `100`, maximum `5000`. |
| `--path <project>` | Select the project root. |
