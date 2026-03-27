# Migrace – pořadí a nasazení

## Řešení častých chyb (Troubleshooting)
1. **Chyba: `function public.notify_schema_change() does not exist`**
   - **Řešení:** Vždy se ujisti, že migrace `02_notify_schema_change.sql` proběhla úspěšně jako první. Pokud chybí tato funkce, většina DDL příkazů (CREATE/ALTER) selže kvůli event triggerům v Supabase.

2. **Chyba: `syntax error at or near "CREATE" LINE XX: AFTER CREATE OR ALTER OR DROP`**
   - **Řešení:** Tato chyba nevzniká přímo ze zdrojových SQL souborů, ale z poškozeného event triggeru v databázi (pravděpodobně z dřívějších pokusů). Řešením je zajistit, že existuje funkce `notify_schema_change()` a případně zkontrolovat v Supabase v sekci *Database -> Triggers / Event Triggers*, zda tam není manuálně vytvořený nevalidní trigger.

3. **Chyby: `relation does not exist` nebo `column does not exist` v PL/pgSQL blocích (např. migrace 61, 62, 64)**
   - **Řešení:** Tyto chyby byly opraveny použitím dynamického SQL (`EXECUTE`). Nyní by měly migrace projít bez chyb i pokud se spouští postupně.

## Pořadí
- Migrace nahrávej ve vzestupném pořadí podle číselného prefixu souboru (lexikograficky): `02_...`, `03_...`, …, `64_...`.
- Pokud nasazuješ databázi od nuly, nahraj všechny migrace v tomto pořadí.

## Minimum pro čisté nasazení (od nuly)
- 02_notify_schema_change.sql
- 03_site_public_config.sql
- 04_lost_found.sql
- 05_sos_contacts.sql
- 06_profiles.sql
- 07_core_tables.sql
- 08_storage_buckets.sql
- 09_lost_found_and_sos_admin_policies.sql
- 10_avatars_bucket.sql
- 11_schema_fixes.sql
- 12_missing_tables_and_rls.sql
- 13_email_settings_imap.sql
- 14_maintenance_window.sql
- 15_profiles_rls_alignment.sql
- 16_db_hardening.sql
- 17_newsletter_categories.sql
- 18_home_widgets.sql
- 19_faq_i18n.sql
- 20_event_photos.sql
- 21_member_documents.sql
- 22_member_admin_profile.sql
- 23_storage_member_applications.sql
- 24_applications_pdf_fields.sql
- 25_password_resets.sql
- 26_app_roles.sql
- 27_site_member_portal_config.sql
- 28_profiles_ui_prefs.sql
- 29_user_security_logs.sql
- 30_profiles_address.sql
- 31_applications_address.sql
- 32_rbac_ruian_and_schema_fixes.sql
- 33_admin_schema_cache_tools.sql
- 34_newsletter_unique_email.sql
- 35_app_user_roles_multi.sql
- 36_polls_public_select_policy.sql
- 37_newsletter_admin_rls.sql
- 38_email_template_overrides.sql
- 39_email_send_queue.sql
- 40_email_bounces.sql
- 41_admin_only_update_policy.sql
- 42_profiles_block.sql
- 43_member_numbers.sql
- 44_membership_expiry.sql
- 45_membership_payments.sql
- 46_rsvp_checkins.sql
- 47_documents_access_and_share.sql
- 48_polls_schema_and_rls.sql
- 49_poll_votes.sql
- 50_post_comments_reactions.sql
- 51_address_validation_meta.sql
- 52_gamification_badges.sql
- 53_error_logs.sql
- 54_feature_flags.sql
- 55_webhooks.sql
- 56_inbox_triage.sql
- 57_newsletter_extensions.sql
- 58_team_and_gallery.sql
- 59_newsletter_stats.sql
- 60_newsletter_ab_and_variants.sql
- 61_newsletter_drafts_ab.sql
- 62_newsletter_ab_constraints.sql
- 63_applications_exclusion.sql
- 64_seed_team_members.sql

## Poznámky k závislostem
- Newsletter drafty se vytváří v `57_newsletter_extensions.sql`; A/B sloupce a constraints jsou v `60–62` a předpokládají existenci těchto tabulek/sloupců.
- `58_team_and_gallery.sql` vytváří `team_members`; `64_seed_team_members.sql` je pouze seed dat (idempotentní).

