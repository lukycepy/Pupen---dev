# Kontaktní matrix (obsah, technika, incidenty)

Tento dokument vymezuje odpovědnosti a kontakty pro běžný provoz Pupen.org a pro řešení incidentů. Kontakty jsou uvedeny ve formě rolí; v případě personální změny se aktualizuje pouze tato tabulka.

## 1) Provozní role

| Oblast | Odpovědná role | Zástup | Kanál 1 (primární) | Kanál 2 (záložní) | Poznámka |
|---|---|---|---|---|---|
| Technika (aplikace, VPS, DB, Cloudflare) | Technická podpora / IT koordinace | Předsednictvo spolku | info@pupen.org | telefon (dle interní evidence) | eskalace při nedostupnosti služby |
| GDPR a osobní údaje (žádosti subjektů údajů) | Pověřená osoba (spolek) | Předsednictvo spolku | gdpr@pupen.org | info@pupen.org | rozhoduje o přístupech a exportech dat |
| Obsah (blog, statické stránky, schvalování) | Vedení spolku (moderace) | Předsednictvo spolku | info@pupen.org | (doplnit) | schvaluje publikaci a řeší stažení obsahu |
| Schránka důvěry (triage, přístup k PII) | Superadmin (pověřený vedením) | určený zástup | info@pupen.org | gdpr@pupen.org | PII přístup je auditovaný |
| E‑maily a doručitelnost (SMTP/Mail server) | Správce e‑mail infrastruktury | Technická podpora | info@pupen.org | (doplnit) | zahrnuje SPF/DKIM/DMARC |

## 2) Incident eskalace (minimální)

1. Detekce incidentu (monitoring / hlášení uživatele) → technická podpora.
2. Pokud incident zahrnuje osobní údaje → bezodkladně zapojit GDPR kontakt.
3. U incidentů s dopadem na reputaci/obsah → zapojit vedení spolku (moderace).
4. V případě potřeby konzultace s fakultou → určená osoba dle dohody (CPIS / tajemník / proděkan).

## 3) Doplnění konkrétních osob (interní evidence)

Konkrétní jména, telefonní čísla a přístupové údaje se vedou v interní evidenci spolku (mimo e‑mailovou komunikaci). Doporučené minimum:

- technický kontakt: jméno + telefon + e‑mail
- GDPR kontakt: jméno + e‑mail
- obsahová odpovědnost: jméno + e‑mail
- minimálně 1 zástup pro techniku (escrow/předávací proces)

