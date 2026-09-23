# Intended use

LongPi is a personal longevity harness inside DeepSeek Harness. It reads one person's profile and the Mirobody record they already connected, chooses longevity skills whose published method matches that situation, and runs the skill script.

It is not a medical device. It does not diagnose, prescribe, or change a dose. An emergency is a direction to call 120 (988 in the United States), then stop.

What the harness will not do:

- Invent a laboratory value, a LOINC code, a genotype, or a coefficient the skill did not print.
- Fill a missing biomarker from a different file.
- Turn a cohort hazard ratio or an animal dose into a personal instruction.
- Store a second copy of the chart. Labs, medicines, and genotypes stay on the Mirobody server.
- Provide accounts, consent, or multi-person isolation. Those stay outside this plugin.

The refusal to discuss a dose change, and the emergency stop, are intercepts in the plugin. The medication intercept fires when a message both mentions a medicine or supplement (generically, by a common name, or by a name on the person's plan) and asks to start, stop, continue, switch or dose it; a question about evidence is not intercepted and is answered from the collected papers without a dose. Editing a skill file does not remove the intercepts.

Before a skill runs, the harness refuses a measurement whose unit is missing where it matters, whose unit is not one the skill declares, or whose value is outside the skill's plausible range. It does not correct a value. The script repeats the same checks.

Session receipts record which skill ran, the revision of the skill checkout, the exit code, the error kind, which input keys were used or missing, and a short excerpt. Earlier readouts keep only the outputs a skill declares. The weekly statistics file holds counts only. They are the replay line for a readout. The staged inputs stay in the local run directory.
