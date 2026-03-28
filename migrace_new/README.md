# migrace_new

Balíček migrací pro nasazení aktuálních změn. Aplikujte v uvedeném pořadí (číslování souborů).

## Pořadí a účel
1. `02_notify_schema_change.sql` – funkce pro reload schema cache (PostgREST) + trigger notifikace
2. `17_newsletter_categories.sql` – newsletter segmentace `categories`
3. `34_newsletter_unique_email.sql` – deduplikace a unique index na `newsletter_subscriptions.email`
4. `38_email_template_overrides.sql` – DB override šablon e‑mailů
5. `39_email_send_queue.sql` – e‑mail fronta + dead letters + RLS + claim funkce
6. `40_email_queue_claim_reclaim_processing.sql` – rozšířený claim pro reclaim zaseknutých jobů
7. `42_newsletter_subscriptions_preferences.sql` – JSONB preference pro newsletter
8. `43_email_settings_tls_ca.sql` – TLS CA a `rejectUnauthorized` pro SMTP
9. `57_newsletter_extensions.sql` – newsletter templates + drafts + RLS (idempotentní)
10. `59_newsletter_stats.sql` – newsletter tracking events + agregované počty + RPC inkrement (idempotentní)
11. `60_newsletter_ab_and_variants.sql` – A/B subject + variant ve trackingu
12. `61_newsletter_drafts_ab.sql` – A/B podpora pro drafts
13. `62_newsletter_ab_constraints.sql` – constraints pro A/B rozsahy
14. `65_events_ticket_sale_end.sql` – `events.time` + `events.ticket_sale_end`
15. `66_rsvp_qr_code.sql` – `rsvp.qr_code` + backfill z `qr_token`
16. `67_newsletter_unsubscribe_reason.sql` – důvody odhlášení newsletteru
17. `68_email_send_queue_headers_text.sql` – email queue: text+headers pro doručitelnost
18. `69_email_settings_application_notifications.sql` – email_settings: cílové adresy notifikací přihlášek
19. `70_email_settings_application_notifications_v2.sql` – email_settings: separace notifikací + DKIM selector

## Poznámky
- Všechny migrace v tomto balíčku volají `SELECT public.notify_schema_change();` kvůli schema cache.
- Migrace jsou psané tak, aby byly bezpečné pro opakované spuštění (IF NOT EXISTS / guardy na policy/constraint).
