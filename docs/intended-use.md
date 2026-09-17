# Intended use

LongPi for DeepSeek Harness is a **longevity concierge prototype**.

It is for:

- product demos and the LongPi launch-day cohort
- engineers exploring a health agent on top of `dsh`
- explaining **demo** phenotype ages, insights, and an event itinerary

It is **not**:

- a medical device
- a diagnostic or treatment system
- a replacement for a physician, concierge, or emergency services
- an EHR, LIS, or wearable OAuth integration
- a place to paste real patient charts (see [SECURITY.md](../SECURITY.md))
- a substitute for running [s2f-agent](https://github.com/JiaqiLi1024/s2f-agent) GPU/API stacks (AlphaGenome, Evo 2, …). DSH only routes and plans; execution stays in that repo, dry-run first.

All bundled numbers belong to the synthetic member **张明远 (demo)**. The UI banner “演示数据 · 非个人病历” is mandatory product copy, not decoration.

If you need clinical documentation drafts and cited FDA/PubMed lookups, use [dsh-medseek](https://github.com/Mr-Neutr0n/dsh-medseek). LongPi does not draft SOAP notes and does not call medical APIs.
