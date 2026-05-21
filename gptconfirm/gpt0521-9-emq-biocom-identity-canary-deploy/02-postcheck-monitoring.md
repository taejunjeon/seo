# Post-check Monitoring

## Early CAPI Presence Check

Read-only query:

- endpoint: `/api/meta/capi/log`
- biocom pixel: `1283400029487161`
- coffee pixel: `1186437633687388`
- window: recent 1 day log with new `user_data_presence` field separated

Result:

```text
biocom records_with_presence_field=8
biocom success=8
biocom ph=true=2
biocom external_id=true=2
biocom fbp=true=8
biocom fbc=true=4
biocom ip=true=8
biocom user_agent=true=8

thecleancoffee records_with_presence_field=3
thecleancoffee success=3
thecleancoffee ph=true=0
thecleancoffee external_id=true=0
```

## Interpretation

- Biocom identity canary is active for eligible new Purchase CAPI records.
- TheCleanCoffee remains excluded by allowlist.
- No extra Purchase events were manually sent by this deploy.

## 24-hour Success Criteria

Continue the canary if:

- CAPI success rate remains 100% or near current baseline.
- `ph=true` and `external_id=true` continue appearing on eligible biocom Purchase records.
- thecleancoffee stays at `ph=false` and `external_id=false`.
- Meta Event Matching Quality improves from the 6.0/10 baseline or Meta Diagnostics stops recommending phone/external ID as strongly.

## Stop / Rollback Criteria

Stop and inspect if any of these appear:

- CAPI send failures increase.
- Meta rejects events due to user data formatting.
- thecleancoffee starts receiving `ph` or `external_id`.
- Purchase counts increase without matching confirmed orders.
- Duplicate event_id risk increases.

## Rollback

Restore the backup files and `.env`, then restart `seo-backend`.

```bash
BACKEND=/home/biocomkr_sns/seo/repo/backend
BACKUP=$BACKEND/_deploy-backup-20260521-emq-identity-canary
sudo cp "$BACKUP/env.ts.before" "$BACKEND/src/env.ts"
sudo cp "$BACKUP/metaCapi.ts.before" "$BACKEND/src/metaCapi.ts"
sudo cp "$BACKUP/.env.before" "$BACKEND/.env"
sudo chown biocomkr_sns:biocomkr_sns "$BACKEND/src/env.ts" "$BACKEND/src/metaCapi.ts" "$BACKEND/.env"
sudo -u biocomkr_sns bash -lc 'export PATH=/home/biocomkr_sns/seo/node/bin:$PATH; cd /home/biocomkr_sns/seo/repo/backend && npm run build && APP_ROOT=/home/biocomkr_sns/seo pm2 restart /home/biocomkr_sns/seo/repo/capivm/ecosystem.config.cjs --only seo-backend --update-env'
```
