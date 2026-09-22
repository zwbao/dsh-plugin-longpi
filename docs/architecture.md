# Architecture

LongPi is the personal layer. Three pieces stay separate.

1. **DeepSeek Harness** hosts the conversation, the tools, and the health board.
2. **longevity-skills** is the method library. Each directory is one published method: a `SKILL.md` plus, when the paper allows a personal readout, `scripts/personal_report.py`. The plugin does not copy those formulas.
3. **dsh-plugin-mirobody** is the read-only data seam. LongPi mounts that plugin's `apply` from `mirobodyPluginHome`, so LOINC, UCUM, and the chart tools register in this process. Wearable login and file ingestion stay in the Mirobody server.

Dispatch is a tool, not a prompt guess:

- `read_personal_situation` loads the saved age, sex, and birth year, plus indicator and medication names the Mirobody server returned.
- `match_longevity_skills` ranks skill directories by the question and by a few indicator signals (phenotypic-age markers, telomere, sleep). Model-organism skills fall back unless the question names that organism.
- `read_longevity_skill` returns that directory's instructions.
- `run_longevity_skill` stages the files the model built from tool results and runs the script with a path jail: relative names and `out/` only, no `..`, no absolute path.

The board is the `健康看板` tab. It shows the same snapshot and lets the person save a profile. Saving a profile does not write Mirobody.

Accounts and consent are out of scope. One DSH profile is one person. Penguin and sequence-to-function tools are not part of this plugin.
