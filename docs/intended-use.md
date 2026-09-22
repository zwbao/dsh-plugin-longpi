# Intended use

LongPi is a personal longevity harness inside DeepSeek Harness. It reads one person's profile and the Mirobody record they already connected, chooses longevity skills whose published method matches that situation, and runs the skill script.

It is not a medical device. It does not diagnose, prescribe, or change a dose. An emergency is a direction to call 120 (988 in the United States), then stop.

What the harness will not do:

- Invent a laboratory value, a LOINC code, a genotype, or a coefficient the skill did not print.
- Fill a missing biomarker from a different file.
- Turn a cohort hazard ratio or an animal dose into a personal instruction.
- Store a second copy of the chart. Labs, medicines, and genotypes stay on the Mirobody server.
- Provide accounts, consent, or multi-person isolation. Those stay outside this plugin.

The refusal to discuss a dose change, and the emergency stop, are intercepts in the plugin. Editing a skill file does not remove them.

Session receipts record which skill ran, the revision of the skill checkout, the exit code, and a short excerpt. They are the replay line for a readout. The staged inputs stay in the local run directory.
