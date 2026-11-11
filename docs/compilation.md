# Compilation policy

Resume TeX supports one UTF-8 source file and two fixed engines, pdfLaTeX and XeLaTeX. Untrusted source is **never** passed to a host TeX process. A sandbox failure is a compile failure, with no fallback. Package installation and font provisioning happen only during trusted setup. Runtime jobs have no package installation path or network.

The choice and alternatives are recorded in [compiler option research](compiler-options.md). TeX Live provides broad template compatibility. Tectonic's untrusted/cached-only controls and browser WebAssembly alternatives remain useful options, but are not substitutes for the enforced boundary tested here.

## Provisioning

`scripts/setup-tex.sh` downloads the TinyTeX-1 v2026.11 Linux x86-64 release and verifies SHA-256 `5b75befa848deae702ae6fa12ff0eef3f110d7e4e2a979ae99f101eba3c9c70d`. It installs required packages/fonts under `.tools/.TinyTeX`, copies the ELF dependency closure of the fixed programs plus selected fonts into `.tools/rootfs`, and records package revision and copied-file hashes. The archive is pinned. Additional TeX Live packages come from the configured distribution repository at setup time; their **realized** revision manifest and rootfs hashes define the toolchain cache identity. That is not a claim that a future rolling repository recreates identical bytes. Preserve or back up the provisioned toolchain for exact reproducibility; deliberate package changes invalidate cached compilation.

Only trusted programs are copied: dynamic loader/shared-library closure, dash, prlimit, head and base64. No host `/`, `/home`, `/etc`, `/usr` or library directory is mounted wholesale. Fontconfig has a curated local font path. The fixed shell runner is application-owned and receives fixed validated engine/flag arguments, with no user shell text. LuaLaTeX is not exposed.

## Runtime boundary

Bubblewrap unshares user, PID, network, IPC, UTS and mount namespaces, clears the environment, starts a new session and dies with its parent. It mounts only the curated root and TeX tree read-only, a read-only source file, proc/dev, and two private writable tmpfs mounts. A separate dynamic-loader environment is not inherited. No home, application database, repository, application keys, external project files or user config enters the job.

| Control                                | Bound                                              |
| -------------------------------------- | -------------------------------------------------- |
| `/work` tmpfs, all outputs combined    | 32 MiB, kernel enforced                            |
| `/tmp` tmpfs, font/cache data combined | 16 MiB, kernel enforced                            |
| CPU per process                        | 12 seconds                                         |
| Address space per process              | 768 MiB                                            |
| Process count                          | 32                                                 |
| Open descriptors                       | 64                                                 |
| Per-file output                        | 12 MiB                                             |
| Wall time                              | 20 seconds for the full sandbox                    |
| Log capture                            | 100,000 bytes                                      |
| Returned PDF                           | 10 MiB, PDF magic checked                          |
| Queue                                  | One active job, at most six active/queued requests |
| Success cache                          | 200 MB by oldest artifact files                    |

The runner performs two fixed engine passes, captures logs inside bounded work space and transports a bounded PDF over a pipe. The supervisor kills the sandbox process group on wall/output limits; PID namespace teardown ends descendants. Host scratch contains only the bounded source input and is removed in `finally`. `openin_any=p`, `openout_any=p`, a scratch-only TEXMF home/cache, and `-no-shell-escape` are defense in depth, not the primary boundary. User latexmk configs are never read; no latexmk subprocess is used.

Success cache identity includes owner, complete source, engine, realized toolchain manifest and policy. Owner metadata is rechecked on download. Failed jobs never overwrite a last successful PDF. The UI marks that retained preview out of date. Current v1 cache/queue limits are per persistent server process; horizontal scaling needs an external worker coordinator and per-host disk quotas. Cache eviction may require recompiling an old download.

## Evidence and limits

The unit suite compiles all four templates in the actual sandbox, extracts their actual PDF text, verifies a second compile hits owner-scoped cache, and rejects another owner's artifact read. A real namespace probe checks that the host home/passwd and an inherited sentinel environment variable are absent and there are no network routes. Trusted benign probes prove sized tmpfs/per-file write failures, CPU termination, wall termination, scratch cleanup and queue recovery. They contain no distributed exploit payloads.

This Linux namespace/runtime policy has been exercised on the authorized boxes.dev development box. It does not establish macOS/Windows or arbitrary shared-host namespace support. Use a separately reviewed container/VM worker before adapting to unsupported hosts. No application service is published by setup.

Full bidirectional SyncTeX is deferred in v1. The current artifact pipeline retains PDFs and logs, without a sandboxed SyncTeX-record query endpoint or tested PDF-coordinate hit mapping. Enabling the compiler flag alone would not produce reliable browser navigation. The viewer instead provides labeled, approximate double-click-to-source lookup using exact visible text; macro expansion, fonts and ligatures can prevent a match. Source-to-PDF navigation is unavailable.

## PDF analysis worker

PDF extraction runs outside the application process in a clean-environment Node worker, with one active worker and at most three active/queued requests. Its bounds are 8 seconds wall time, 6 CPU seconds, 2 GiB virtual address space, a 128 MiB V8 heap, fixed Node/native thread-pool settings, 64 descriptors, no core dumps, 10 MiB PDF input, 4 MB returned JSON, 20,000 text items and 200,000 extracted characters. Node's Wasm trap-handler reservation is disabled so a finite address-space limit can be used. This is resource isolation for the trusted PDF parser; it is distinct from the compiler's filesystem/network sandbox.

Input/output/error descriptors point to a private temporary directory; output/error files each have a 4 MiB kernel file-size cap, and all are deleted in `finally`. Using regular descriptors avoids a Bun/Node pipe-startup failure observed during verification. The parent kills the entire worker process group at the wall deadline and validates the bounded JSON output. A benign deadline/oversize test proves failure and subsequent queue recovery. Application credentials never enter this worker's environment.
