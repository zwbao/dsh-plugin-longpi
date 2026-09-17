# Contributing

This plugin is meant to be the reference longevity agent for DeepSeek Harness. PRs that make the demo more honest, the UI more readable, or the guardrails stricter are welcome. PRs that add diagnosis, drug-interaction checkers, or silent PHI uploads will be rejected.

## Bar

- `npm test` stays green.
- Tool count in the README must match `registerTools`.
- No `curl | bash` in install docs.
- Synthetic data only in fixtures and screenshots.
- English README and `README.zh.md` stay in sync on user-facing claims.

## Dev

```sh
npm install
npm test
```

To mount a checkout:

```sh
dsh plugin --profile web add "$PWD"
dsh --profile web --dump-config   # expect "# == dsh-plugin-longpi"
```

## Listing

Add the GitHub topic `dsh-plugin` so [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) can discover the repo. Being listed is not a security review.
