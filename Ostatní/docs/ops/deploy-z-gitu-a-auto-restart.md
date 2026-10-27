# Deploy z Gitu a automatický restart

Tento postup je určený pro VPS, kde běží aplikace Pupen přes `pm2` pod názvem `pupen-app`.

## Co je připravené

V repozitáři je skript:

`Ostatní/scripts/ops/deploy-from-git.sh`

Ten udělá:

1. načte `.env`, `.env.local`, `.env.production`, `.env.production.local`
2. zkontroluje, že repozitář nemá lokální změny
3. provede `git fetch` + `git pull --ff-only`
4. spustí `npm ci`
5. volitelně spustí DB migrace
6. spustí `npm run build`
7. restartuje `pm2 restart pupen-app --update-env`
8. zkusí lokální health check `http://127.0.0.1:3000/api/health`

Skript nepřebírá hesla na CLI. Pokud něco potřebuje aplikace nebo DB skripty, bere se to z `.env` souborů v rootu projektu.

## Jednorázově na VPS

Po prvním nahrání repozitáře nastavte právo ke spuštění:

```bash
chmod +x Ostatní/scripts/ops/deploy-from-git.sh
```

## Běžný deploy

Na VPS v rootu projektu spusťte:

```bash
./Ostatní/scripts/ops/deploy-from-git.sh
```

To stačí pro běžný deploy bez DB migrací.

## Deploy včetně DB migrací

Pokud release obsahuje i databázové migrace:

```bash
./Ostatní/scripts/ops/deploy-from-git.sh --with-db
```

Tím se navíc zavolá:

```bash
npm run db:migrate:prod
```

`DATABASE_URL_PROD` nebo `DATABASE_URL` se načtou automaticky z `.env`.

## Volitelné přepínače

Bez instalace balíčků:

```bash
./Ostatní/scripts/ops/deploy-from-git.sh --skip-install
```

Bez buildu:

```bash
./Ostatní/scripts/ops/deploy-from-git.sh --skip-build
```

## Důležité poznámky

- Skript schválně skončí chybou, pokud má repozitář na VPS lokální změny. Tím se předejde přepsání rozpracovaných úprav.
- Restart běží přes `pm2 restart pupen-app --update-env`, takže se znovu načtou i nové env proměnné.
- Pokud `git pull` selže na lokálních změnách, udělejte nejdřív `git status` a pak změny commitněte nebo stashněte.
- Pokud health check selže, zkontrolujte logy:

```bash
pm2 logs pupen-app --lines 100
```

## Nejkratší použití

Bez migrací:

```bash
./Ostatní/scripts/ops/deploy-from-git.sh
```

S migracemi:

```bash
./Ostatní/scripts/ops/deploy-from-git.sh --with-db
```
