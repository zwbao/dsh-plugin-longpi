# Security

## What this plugin can do

Installing a DSH plugin runs third-party code with your user permissions. This bundle:

- registers 8 model-facing tools and 3 skills
- injects a longevity-concierge persona into the system prompt
- serves `GET /api/longpi/dashboard` on the local DSH web server (loopback)
- does **not** call the network, read your EHR, or write the workspace filesystem

It does **not** disable DSH's built-in `bash` / `fs` tools. Treat a shared demo machine as untrusted for secrets.

## PHI / PIPL

Do not paste real names, phones, lab PDFs, or prescriptions into a session that uses this plugin unless your model provider is under a contract that covers health data.

Demo fixture data is still treated as sensitive in a live room: people will screenshot it.

## Medical safety (enforced in code)

| Layer | Behavior |
|---|---|
| Persona | No diagnosis language; no dose changes |
| `agent/pre-step` | Emergency keywords → 120 script; medication-change intent → refuse + concierge |
| Write tools | 1 appointment and 1 handoff per process |
| Output | Every dashboard/tool payload includes `disclaimer_zh` |

This is not a substitute for clinical review.

## Reports

Open a GitHub issue for non-sensitive bugs. For a vulnerability that could leak health data, do not file a public issue — contact the maintainers privately.
