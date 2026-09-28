# Packaging the plugin and the library

`dsh-plugin-longpi` depends on one exact `longevity-skills` version. There is no `postinstall`. `npx dsh-plugin-longpi install`, `longpi install`, `longpi update`, and `longpi status` run `install.sh`. dsh and pnpm are global CLIs (`ensure_cli`), not npm dependencies of the plugin.

The placeholder pin is **2026.39.1**. That is the first library release that refuses a bare `agatston` alias (it must not map `agatston` onto abdominal aortic calcium). The library checkout this repo tests against may still be `2026.39.0`. `versionCheck` then reports a mismatch and will not label a result `verified`. `longpi status` and the `longpi_status` tool both show that.

## Build the library tarball

The library repository is published by the lead. From this plugin repo, pack a checkout without modifying it:

```bash
node scripts/pack-longevity-skills.mjs /path/to/longevity-skills --out /tmp
```

The package version is the checkout's `VERSION` file. `--version` overrides that string in the tarball only.

## How to bump the pin

1. Confirm the published `longevity-skills` version contains the Agatston refusal.
2. Set `dependencies.longevity-skills` in `package.json` to that exact version. No `^`, `~`, or range.
3. Set `SKILLS_PIN_DEFAULT` in `install.sh` to the same string. `curl | bash` cannot read `package.json`; a copy of the script next to this package reads the dependency, and the default is the fallback. `test/packaging.mjs` fails if the two strings differ.
4. A library-only change is a new plugin dependency and a new plugin patch version. Do not fast-forward a git checkout over a package install. `longpi update` installs the newer plugin and the `longevity-skills` version that plugin depends on.
5. The Python venv is rebuilt only when `requirements-ci.txt` changes.

`npm ci` in this repo cannot resolve `longevity-skills@2026.39.1` until that version is on the registry. Tests use `LONGEVITY_SKILLS_HOME` and do not install the dependency. Do not refresh `package-lock.json` until the lead publishes the pin.
