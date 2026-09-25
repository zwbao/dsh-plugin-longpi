# Intended use

LongPi is a personal longevity harness inside DeepSeek Harness. It reads one person's profile and the Mirobody record they already connected, chooses longevity skills whose published method matches that situation, and runs the skill script.

It is not a medical device. It does not diagnose, prescribe, or change a dose. An emergency happening now is a direction to call 120 (outside China, the local emergency number), then stop; thoughts of self-harm get a mental-health crisis line or someone they trust, 120 if in danger, and 988 in the United States.

What the harness will not do:

- Invent a laboratory value, a LOINC code, a genotype, or a coefficient the skill did not print.
- Fill a missing biomarker from a different file.
- Turn a cohort hazard ratio or an animal dose into a personal instruction.
- Store a second copy of the chart. Labs, medicines, and genotypes stay on the Mirobody server.
- Provide accounts, consent, or multi-person isolation. Those stay outside this plugin.
- Write a plan, add an item, or set a goal the person did not state. A plan is saved only after the person confirms the read-back.
- Store or suggest a dose. Medicines and supplements in a plan are kept by name; their schedule, dose and dose log stay in Mirobody, which the plugin only reads.
- Give a personal lifespan figure. Model outputs (phenotypic age, the model's 10-year mortality risk, and China-PAR once its coefficients are verified) are shown as model estimates with their boundary.

The emergency and medication boundaries are enforced by a guard in the plugin, in layers. Each new message is labelled by the model the conversation already uses (an emergency happening now, thoughts of self-harm, a request to start, stop, change or be prescribed a medicine or supplement, a personal dose question, a research question), within 4 seconds; when that call fails, a narrow set of rules decides, and a negated symptom, a family member's history, a past event or a question about risk is not an emergency. The guard never replaces the person's words: it adds one note for the model after them, and in an emergency no skill runs that turn. Before a turn closes, the reply is checked, by rules and by the same model, for a personal dose or advice to start, stop or change a medicine; if one is found the model sends a short correction, at most once per turn. A plan saved from chat needs the read-back first and then the person's approval in DeepSeek Harness. The guard's statistics are counts only. Editing a skill file does not remove the guard.

Before a skill runs, the harness refuses a measurement whose unit is missing where it matters, whose unit is not one the skill declares, or whose value is outside the skill's plausible range. It does not correct a value. The script repeats the same checks.

Session receipts record which skill ran, the revision of the skill checkout, the exit code, the error kind, which input keys were used or missing, and a short excerpt. Earlier readouts keep only the outputs a skill declares. The weekly statistics file holds counts only. They are the replay line for a readout. The staged inputs stay in the local run directory.

The intervention plan and check-ins are new personal data kept in `dataDir/interventions/` on this machine, next to the profile and earlier readouts. Nothing is uploaded. A verdict says whether a change is larger than within-person biological and analytical variation (the reference change value), whether the retest came late enough, whether the plan was followed, and what else changed at the same time; it does not say a change was caused by the item. Trial effects shown beside a change are population averages from the cited paper, not a prediction for the person.
