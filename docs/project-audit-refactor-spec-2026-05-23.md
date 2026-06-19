# Projektový Audit A Refactor Spec

Datum: `2026-05-23`
Projekt: `Pupen 4.0`
Scope: Next.js App Router, TypeScript, Tailwind CSS, Supabase, Auth/OAuth, UX, formuláře, výkon a bezpečnost

## Cíl

Provést řízený, produkčně bezpečný audit a refactor celé codebase podle zadaných 200 bodů. Cílem není "mechanicky odškrtat seznam", ale:

- snížit architektonický dluh,
- odstranit rizikové bezpečnostní a výkonové slabiny,
- stabilizovat rendering a auth flow,
- zlepšit typovou bezpečnost,
- sjednotit UI/UX a formulářové chování,
- zachovat průchod `npm run build` a `npm run lint`.

## Rychlý Baseline Audit

### Již v dobrém stavu

- `App Router` je nasazený konzistentně.
- `tsconfig.json` má `strict: true`.
- V projektu nejsou nalezené importy z `next/router`.
- Existují `robots.ts` a `sitemap.ts`.
- Server auth, Supabase RLS klient i server klient už mají oddělené utility.
- Projekt má silné pokrytí API route handlerů a interních guardů.

### Rizikové nálezy

1. Přesycení klientskými komponentami
- V `app/` je aktuálně cca `181` souborů s `'use client'`.
- To samo o sobě není bug, ale je to silný signál, že velká část stromu jde renderově zbytečně na klienta.

2. Chybějící route segment UX vrstva
- Nenalezen žádný `loading.tsx`.
- Jen jeden segmentový `error.tsx`.
- Jen kořenové a jazykové `not-found.tsx`.

3. Příliš široká konfigurace obrázků
- `next.config.mjs` má `images.remotePatterns` s `hostname: '**'`.
- To je příliš permissive a jde proti bezpečné image policy.

4. Stále existují reálné `<img>`
- Výskyt mimo emaily a generované HTML je potřeba cíleně odstranit.
- Email šablony jsou legitimní výjimka.

5. Build warning kolem PDF route
- `next build` hlásí NFT trace warning z `app/api/admin/membership-applications/[applicationId]/pdf/generate/route.ts`.
- Příčina: dynamická práce s FS / `process.cwd()` v route handleru.

6. TypeScript není dotažen do "hard strict"
- `allowJs: true`
- `skipLibCheck: true`
- chybí explicitní `noImplicitAny`, `strictNullChecks` atd. v configu, byť jsou částí `strict`.

7. Tailwind governance není dostatečně centralizovaná
- Nebyla nalezena samostatná `tailwind.config.*`.
- Projekt běží na Tailwind v4 stylu, ale bez jasně centralizovaných tokenů a helperu `cn`.

8. Form layer je nejednotná
- Část složitých formulářů už používá RHF + Zod.
- Část veřejných formulářů stále jede přes lokální `useState`.

## Strategie Realizace

Tento scope není bezpečné řešit jedním velkým commitem. Doporučený postup je po 6 dávkách:

### Batch 1: Architektura, Rendering, Routy, Image Policy

Priorita: kritická

- audit `use client` a přesun stavů níž ve stromu
- doplnění `loading.tsx` pro hlavní segmenty
- rozšíření `error.tsx` a `not-found.tsx`
- odstranění reálných `<img>` z webového UI
- zpřísnění `images.remotePatterns`
- oprava build warningu kolem PDF route

Výstup:
- lepší TTFB/SSR rozdělení
- menší client bundle
- bezpečnější image policy

### Batch 2: TypeScript Hardening

Priorita: kritická

- audit `any`, `{}`, `Object`, nebezpečných castů
- centralizace sdílených typů
- zlepšení type-safe mapování DB modelů
- type guards a `unknown` na externích vstupech
- odstranění dead typů/importů

Výstup:
- méně runtime bugů
- lepší DX a refactor safety

### Batch 3: Supabase, DB, RLS, Storage

Priorita: kritická

- audit migrací, indexů, constraints, cascade rules
- RLS coverage a ověření policy režimů
- storage bucket separation public/private
- upload validace a velikostní limity
- detekce duplicitních M:N vazeb

Výstup:
- lepší bezpečnost dat
- menší DB latency
- čistší storage model

### Batch 4: Auth, Middleware, OAuth, Session Flow

Priorita: kritická

- audit middleware ochrany admin/member rout
- callback URL, redirect flow, logout flow
- session expiry UX
- multi-tab sync
- OAuth edge cases
- audit bezpečnostního logování

Výstup:
- méně auth regressí
- nulové probliknutí chráněného UI

### Batch 5: UI/UX, Tailwind, Dark Mode, Modal Layer

Priorita: vysoká

- zavedení `cn`
- konsolidace Button/Input/Panel primitives
- focus states, scroll lock, modal accessibility
- mobile overflow audit
- 320px audit
- unified empty states a toasty

Výstup:
- výrazně konzistentnější UI
- lepší přístupnost

### Batch 6: Formuláře, Sanitizace, RHF/Zod sjednocení

Priorita: vysoká

- migrace veřejných a admin formulářů na jednotný pattern
- field-level errors
- dirty state protection
- enter submit, autocomplete, maxLength, trimming
- server validation contract pro RHF

Výstup:
- méně chyb při submitu
- menší počet duplicitních patterns

## Mapování 200 Bodů Na Praktické Epiky

Namísto řešení 200 bodů 1:1 je efektivnější je seskupit:

1. `Rendering & Routes`
- body: `1–25`, `115–121`

2. `Type Safety & Shared Types`
- body: `26–50`

3. `Supabase & Database`
- body: `51–75`

4. `Auth, Middleware & OAuth`
- body: `76–100`

5. `UX, Interactions & Accessibility`
- body: `101–125`

6. `Forms & Validation`
- body: `126–150`

7. `Tailwind & Design Hygiene`
- body: `151–175`

Poznámka:
- body `176–200` nebyly v zadání fyzicky dopsané, ale audit počítá s tím, že budou pokryté v návazných optimalizacích build/perf/security.

8. `Code Quality, Performance & Production`
- body: `176–200`

## Doplneni Bodů 165-200

### Tailwind & Design Hygiene - doplneni

165. Overit a sjednotit vyuziti Tailwind nesting tam, kde projekt pouziva zanoreni nebo `@apply` v `app/globals.css`.

166. Auditovat kombinace `text-*` a `leading-*`, zejmena u hero nadpisu, dashboard karet a rich textu, aby nedochazelo k prekryvani radku.

167. Sjednotit shadow scale napric aplikaci:
- `shadow-sm` pro jemne inputy/panely
- `shadow-md` pro dropdowny a plovouci bloky
- `shadow-lg` jen pro modaly, hero CTA a vyrazne elevated surfaces

168. Zkontrolovat sklenene efekty:
- `opacity`
- `bg-white/..` a `dark:bg-.../..`
- `backdrop-blur`
- kontrast textu nad poloprůhlednymi vrstvami

169. Auditovat SVG ikony:
- explicitni `w-* h-*`
- `stroke="currentColor"` nebo `fill="currentColor"`
- konzistentni velikosti v navigaci, tabulkach a tlacitkach

170. Omezit hardcoded pixel utility jako `w-[347px]`, `h-[91px]`, `rounded-[37px]`, pokud existuje rozumna nativni Tailwind skala nebo procentualni/responzivni alternativa.

171. Zkontrolovat datove tabulky a seznamy:
- spravne pouziti `whitespace-nowrap`
- `break-words`
- `truncate`
- stabilni chovani na mobilu i desktopu

172. Sjednotit border system:
- svetly rezim `border-stone-200`
- tmavy rezim `dark:border-stone-800`
- vyjimky jen pro destruktivni/pozitivni akce

173. Auditovat pseudo-element utility:
- `before:`
- `after:`
- korektni `content-['']`
- zadne "mrtve" pseudo-elementy bez content

174. Overit, ze `hidden` elementy nevytvareji layout glitch v `grid` nebo `flex` kontejnerech a ze je pripadne vhodnejsi pouzit `sr-only`, `invisible` nebo podminene renderovani.

175. Overit, ze produkcni build opravdu odstranuje nepouzity Tailwind CSS kod a ze projekt negeneruje zbytecne siroky CSS surface.

### Kategorie 8: Code Quality, Vykon & Produkce

176. Odstranit zapomenute debug vystupy:
- `console.log`
- `console.error` tam, kde nema zustat server-side error reporting
- `debugger`

177. Vycistit zakomentovane bloky stareho kodu a docasne poznamky, ktere uz neslouzi jako validni dokumentace.

178. Auditovat zavislosti v `package.json` a identifikovat nepouzivane balicky. Preferovany nastroj: `depcheck` nebo ekvivalentni audit.

179. Presunout build/dev-only balicky do `devDependencies`, pokud nejsou potreba za behu v produkci.

180. Provest `npm outdated`, vyhodnotit rizikove a bezpecnostni aktualizace a resit peer dependency konflikty po davkach.

181. Zkontrolovat a pripadne zprisnit konfiguraci ESLint a formatter workflow pro IDE a CI.

182. Auditovat `useEffect` cleanup:
- event listenery
- `setTimeout` / `setInterval`
- realtime subscriptions
- `BroadcastChannel`
- observery

183. Pouzit `React.useMemo` a `React.useCallback` pouze tam, kde je to meritelne prinosne a kde stabilizace referenci realne zlepsuje rendering.

184. Rozsirit vyuziti `next/dynamic` pro velke a zridka pouzivane klientské casti:
- editory
- mapy
- grafy
- heavy admin moduly

185. Auditovat zavislosti v `useEffect` a odstranit nekonecne rerender smycky nebo nechtene re-fetch patterns.

186. Overit environment management:
- `.env.local` pro lokal
- Vercel env parity
- staging/production rozdeleni
- validace klicovych env pri startu

187. Auditovat uniky secretu:
- `.env` v `.gitignore`
- zadne tajne hodnoty v klientskem bundle
- zadne unikle klice v docs, ukazkach nebo skriptech

188. Analyzovat bundle size a navrhnout code splitting podle realnych hotspots.

189. Vyhodnotit Lighthouse / Core Web Vitals:
- LCP
- INP
- CLS
- navrhnout a implementovat konkretni zlepseni

190. Sjednotit export strategy:
- preferovat konzistentni konvenci
- neprechazet chaoticky mezi `default export` a `named export` bez duvodu

191. Auditovat semantiku HTML:
- `main`
- `section`
- `header`
- `nav`
- `footer`
- `article`

192. Doplnit validni a lokalizovane `alt` texty ke vsem relevantnim obrazkum.

193. Dopsat `aria-label` nebo `aria-describedby` na ikonova tlacitka bez viditelneho textu.

194. Otestovat ovladatelnost cele aplikace pouze klavesnici:
- poradi focusu
- focus-visible stavy
- modal/dropdown escape flow

195. Overit korektni `lang` atribut v root HTML dokumentu a zajistit jazykovou presnost podle aktivni locale.

196. Zlepsit resilienci pro externi API:
- timeouty
- fallback stavy
- retry jen tam, kde dava smysl
- korektni error mapping do UI

197. Rozdelit soubory nad ~250 radku, pokud nesou vice nez jednu odpovednost nebo kombinuji data, render i business logiku.

198. Sjednotit komentarovy styl a dopsat strucny JSDoc ke slozitejsim transformacim, guardum a utilitam.

199. Auditovat konfiguraci Vercel deploymentu:
- `next.config.mjs`
- pripadny `vercel.json`
- cache headers
- redirects
- routing expectations

200. Kazdou implementacni davku zakoncit `npm run build` a postupne odstranit i warnings, ne jen errors.

## Konkrétní First Batch K Provedení

Doporučená první implementační sada:

1. Zpřísnit `next.config.mjs`
- odstranit `hostname: '**'`
- definovat explicitní whitelist domén

2. Najít a nahradit webové `<img>` za `next/image`
- ponechat výjimky pro email HTML a generovaný HTML obsah

3. Přidat `loading.tsx`
- minimálně pro:
  - `app/[lang]/page`
  - `app/[lang]/akce`
  - `app/[lang]/novinky`
  - `app/[lang]/login`
  - `app/[lang]/admin/dashboard`
  - `app/[lang]/clen`

4. Zredukovat top-level `'use client'`
- začít:
  - `app/[lang]/page.tsx`
  - `app/[lang]/admin/page.tsx`
  - `app/[lang]/clen/page.tsx`
  - další routy, kde lze oddělit shell a interaktivní leaf nodes

5. Opravit NFT build warning
- refactor načítání PDF template tak, aby nepůsobilo broad filesystem trace

6. Zavést `lib/ui/cn.ts`
- postupně přepojit nejpoužívanější komponenty

7. Prvni produkcni quality pass
- audit `console.*`
- audit `<img>` vs `next/image`
- audit ikonovych tlacitek bez `aria-label`
- audit nejvetsich klientskych souboru

## Guardrails Pro Implementaci

- Každá dávka musí končit:
  - `npm run build`
  - `npm run lint`
  - případně cílenými smoke/E2E testy
- Žádný destruktivní zásah do existujících migrací bez jasné náhrady.
- Žádné "big-bang" refactory přes celý projekt bez mezikontrol.
- Každá dávka musí být samostatně deploynutelná.

## Doporučené Pořadí Dalších Kroků

1. Implementovat `Batch 1`
2. Spustit build + lint + smoke
3. Vyhodnotit bundle/render dopad
4. Pokračovat `Batch 2`

## Stav

Tento dokument je výchozí realizační spec.
Je připravený jako základ pro iterativní implementaci dalších batchů.
