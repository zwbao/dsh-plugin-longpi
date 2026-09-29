# Packaging the plugin and the library

`dsh-plugin-longpi` has no npm dependency on `longevity-skills`. There is no `postinstall`. `npx dsh-plugin-longpi install`, `longpi install`, `longpi update`, and `longpi status` run `install.sh`. dsh and pnpm are global CLIs (`ensure_cli`), not npm dependencies of the plugin.

`install.sh` places the library from `node_modules/longevity-skills` when one is there, otherwise from `LONGPI_SKILLS_URL` (a tarball or a git URL), otherwise by cloning `https://github.com/zwbao/longevity-skills` (main), or a mirror with `--mirror cn`. `SKILLS_PIN_DEFAULT` is empty, so `skillsVersion` stays empty and `versionCheck` treats the running catalog as the reference. Setting `skillsVersion` to a version that does not match the running catalog downgrades `verified` results to `unverified-binding`.

## Build the library tarball

The library repository is published by the lead. From this plugin repo, pack a checkout without modifying it:

```bash
node scripts/pack-longevity-skills.mjs /path/to/longevity-skills --out /tmp
```

The package version is the checkout's `VERSION` file. `--version` overrides that string in the tarball only.

