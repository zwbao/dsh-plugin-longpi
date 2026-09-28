# Local reference aggregator

This process sums **masked** fixed-point shares for a simulated LongPi study. It is the only host the shipped manifests will talk to (`http://127.0.0.1` or `localhost`).

It does not store raw lab values, names, or free text. A request that includes any field other than the share protocol is rejected.

`dev-signing-key.pem` signs the two study manifests for **simulated** mode. It is not a production signing key. This build refuses `scienceMode: live` even if a manifest verifies with this key. Live stays off until a legal entity holds a signing key, an ethics committee has approved the study, and the walking study has a ChiCTR id (D6).

```bash
node tools/aggregator/server.mjs --port=18184
```

Round:

1. `POST /v1/rounds` `{ study_id, stat_key, min_cohort }`
2. Each node `POST /v1/rounds/:id/join` `{ client_id, public_b64 }` (X25519, 32 bytes)
3. `GET /v1/rounds/:id` to collect every public key
4. Each node `POST /v1/rounds/:id/share` `{ client_id, masked_b64, commitment }`
5. `POST /v1/rounds/:id/finalize` returns the sum and the mean, or `released: false` when fewer than `min_cohort` shares arrived

Pairwise masks cancel in the sum. One share on its own is not a lab value. That round still fails closed if anyone who joined does not submit.

## Threshold round (v2)

`src/science/threshold.ts` deals a mask seed with Shamir, threshold `t`. Survivors add the shares they hold and the server reconstructs only the sum of the seeds of people who submitted. A round with 10–30% dropouts still finishes when at least `t` people remain. Fewer than `t` fails closed.

The production skeleton is `tools/aggregator/prod-server.mjs` with `config.example.json`: mainland bind, TLS required, rate limit, audit log, `/healthz` and `/readyz`, offline root key, key id on the feed. The example config does not listen. The dev key `longpi-sim-dev-1` is rejected when `accept_dev_key` is false, and it is never accepted for `scienceMode: live`. Live stays off.
