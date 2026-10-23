# Off‑site zálohy (DB + soubory) – minimální plán

Tento dokument popisuje minimální a proveditelné nastavení off‑site záloh pro Pupen.org tak, aby bylo možné prokázat obnovu a snížit riziko ztráty dat. Není vázán na konkrétního poskytovatele úložiště (S3/Storage Box/Drive apod.), ale vyžaduje úložiště mimo Supabase i mimo VPS.

## 1) Cíl a princip

- Záloha musí být fyzicky uložena mimo Supabase a mimo VPS.
- Záloha musí být periodická, automatizovaná a auditovatelná (záznam běhu).
- Obnova musí být reálně otestována (záznam testu obnovy).

## 2) Co zálohovat

### 2.1 Databáze (PostgreSQL v Supabase)

- Doporučený formát: `pg_dump` (custom nebo plain), šifrovaný archiv (např. `age`/`gpg`).
- Frekvence: 1× denně (minimálně), retence např. 14–30 dnů.
- Poznámka: pro incidentní obnovu je cenné mít i „týdenní“ a „měsíční“ snapshot.

### 2.2 Soubory (Supabase Storage nebo VPS disk)

- Pokud používáte Supabase Storage: off‑site export bucketů (rekurzivní synchronizace) do externího úložiště.
- Pokud používáte VPS disk: off‑site synchronizace vybraných adresářů (jen aplikační data, ne build artefakty).
- Frekvence: 1× denně; u citlivých bucketů je možné častěji.

## 3) Kde zálohy držet (off‑site)

Vyplnit podle aktuálního řešení:

- Poskytovatel úložiště:
- Umístění (region):
- Přístup (technický účet, MFA):
- Šifrování: ano/ne, metoda:
- Retence a mazání starých záloh:

## 4) Automatizace (doporučený postup)

### 4.1 Spouštění

- Cron na VPS (např. 1× denně v noci).
- Alternativně GitHub Actions do externího úložiště (pokud dává bezpečnostní smysl a jsou vyřešené secret managementy).

### 4.2 Minimální kontrolní body

- Záloha DB: velikost souboru > 0, návratový kód 0, hash uložen.
- Záloha souborů: počet objektů > 0 (nebo aspoň „sync OK“), návratový kód 0.
- V obou případech: záznam do `zaznam-testu-obnovy.md` (část „Běhy záloh“).

### 4.3 Minimální “backup job” v repozitáři

Repo obsahuje provozní skripty (spouštěné na VPS):

- DB záloha: `npm run backup:db` (výstup do `ops/backup-artifacts/`)
- Storage záloha: `npm run backup:storage` (výstup do `ops/backup-artifacts/`)
- Plný běh (DB + storage + ověření hashů): `npm run backup:run`

Proměnné pro běh:

- `BACKUP_DIR` (volitelné): cílová složka pro artefakty (default `ops/backup-artifacts`)
- `BACKUP_STORAGE_BUCKETS` (volitelné): `bucket1,bucket2,...`; pokud není vyplněno, script zálohuje pouze privátní buckety
- `BACKUP_STORAGE_INCLUDE_PUBLIC=true` (volitelné): zahrne i public buckety
- `BACKUP_STORAGE_CONCURRENCY` (volitelné): paralelismus stahování (default 4)

### 4.4 Cron šablona (VPS)

Předpoklady na VPS:

- `pg_dump`, `pg_restore`, `psql` (postgres klientské nástroje)
- `node` a `npm`

Příklad cron jobu (1× denně ve 03:20, s logem a ochranou proti paralelnímu běhu):

```cron
20 3 * * * root cd /opt/pupen && /usr/bin/flock -n /tmp/pupen_backup.lock npm run backup:run >> /var/log/pupen_backup.log 2>&1
```

Po prvním úspěšném běhu (nebo po pravidelném běhu) lze zapsat artefakty do evidence:

- `npm run backup:record`

## 5) Doporučené bezpečnostní minimum

- Zálohy vždy šifrovat před uložením mimo VPS.
- Oddělený účet pro backup s minimálními právy.
- Pravidelně testovat obnovu (min. 1× měsíčně) a evidovat výsledek.

