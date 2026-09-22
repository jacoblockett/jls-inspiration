# History Runtime

`history` is the SQLite interface used to persist Inspiration research history.

It is independent from the screenshot tool. Its source lives under `history/`, and target builds produce `bin/history` or `bin/history.exe`.

## Project state

The runtime owns only:

```text
.inspiration/
├── project.json
└── research.db
```

Other Inspiration working files are outside the history runtime's responsibility.

## Commands

```text
history init [--path <project>]
history get <url> [--track visual|product] [--path <project>]
history write <url> --track visual|product --stage <stage> [options]
history search [text] [filters]
```

Run `history --help`, `history help <command>`, or `history <command> --help` for the full CLI reference.

### init

Initializes `.inspiration/project.json` and `.inspiration/research.db` for the selected project. The current directory is used when `--path` is omitted.

### get

Reads history for one URL without writing anything. The result distinguishes:

- `exact_seen`: the exact canonical URL has been recorded.
- `route_seen`: other recorded URLs belong to the same obvious enumerated/resource route family.
- `domain_seen`: other recorded URLs exist on the same site.

Related URLs never become exact visits. For example, prior visits to `/blog/page/1` and `/blog/page/2` can make `/blog/page/3` a route-family match without claiming page 3 was visited.

The route-family heuristic recognizes obvious numeric IDs, UUIDs, long hexadecimal IDs, numbered page path segments, and common numeric pagination query parameters. It is intentionally conservative rather than treating arbitrary slugs as equivalent.

### write

Records research activity for one URL.

Stages are:

- `discovered`: found as a candidate.
- `visited`: materially inspected.
- `captured`: saved evidence was captured; requires `--artifact`.
- `inspected`: a source or registered artifact was inspected.
- `accepted`: researcher or auditor accepted the source/artifact.
- `rejected`: researcher or auditor rejected the source/artifact.

`--actor` is `researcher` by default and may be set to `auditor`. Artifact-level judgments use `--artifact <file>`. Captured artifacts are SHA-256 hashed so duplicate evidence can be identified across sources.

### search

Searches recorded URLs, domains, notes, and artifact paths. Search text is optional, so the same command also handles filtered browsing without a separate list operation.

Available filters:

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
