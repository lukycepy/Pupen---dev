## 1.Architecture design
```mermaid
graph TD
  A["Uživatel v prohlížeči"] --> B["Next.js aplikace (React UI)"]
  B --> C["Server layer (Route Handlers / Server Actions)"]
  C --> D["Supabase SDK"]
  D --> E["Supabase (Auth + Postgres + Storage)"]
  C --> F["SMTP služba"]
  C --> G["Google GenAI (volitelně)"]

  subgraph "Frontend Layer"
    B
  end

  subgraph "Backend Layer (v rámci Next.js)"
    C
  end

  subgraph "Service Layer (Provided by Supabase)"
    E
  end

  subgraph "External Services"
    F
    G
  end
```

## 2.Technology Description
- Frontend: Next.js@16 + React@19 + tailwindcss@4 + lucide-react
- Backend: Next.js Route Handlers (Node runtime) + nodemailer + zod + pdf-lib
- Data/State: @tanstack/react-query + react-hook-form
- Backend service: Supabase (Auth + PostgreSQL + Storage)  
  - Storage: ukládání generovaných PDF přihlášek (pokud se negenerují on-the-fly)

## 3.Route definitions
| Route | Purpose |
|-------|---------|
| /[lang]/login | Přihlášení a směrování dle role |
| /[lang]/admin | Vstup do adminu (redirect na login) |
| /[lang]/admin/dashboard | Pupen Control – sjednocený admin dashboard |
| /[lang]/admin/prihlasky | Admin: seznam/detail přihlášek + stažení PDF |
| /[lang]/admin/queue | Admin: zobrazení/úpravy Queue |
| /[lang]/admin/newslettery | Admin: správa a odesílání newsletterů + logy |
| /[lang]/clen | Členský portál (/clen) |
| /[lang]/clen/prihlaska | Přihláška do členství (vstup + stav + PDF) |

## 4.API definitions (If it includes backend services)
### 4.1 Core API
Administrace a automatizace (příklady existujících route handlerů)
```
POST /api/admin/send-password
POST /api/admin/send-ticket
GET  /api/admin/digest
GET  /api/admin/promo/rules
POST /api/admin/promo/rules/set
POST /api/admin/refunds/update
GET  /api/admin/refunds/logs

GET  /api/admin/prihlasky
PATCH /api/admin/prihlasky/:id
GET  /api/admin/prihlasky/:id/pdf

GET  /api/admin/queue
PATCH /api/admin/queue/:id
POST /api/admin/queue/:id/retry

POST /api/admin/newsletter/send
GET  /api/admin/newsletter/logs
POST /api/admin/newsletter/retry
```
Komunikace a GDPR (příklady)
```
POST /api/dm/send
GET  /api/dm/threads
POST /api/gdpr/export
POST /api/gdpr/delete
```

Sdílené TypeScript typy (koncept)
```ts
type Lang = 'cs' | 'en';

type UserProfile = {
  id: string; // UUID
  email?: string;
  first_name?: string;
  last_name?: string;
  is_admin?: boolean;
  is_member?: boolean;
  can_manage_admins?: boolean;
  // + can_view_X / can_edit_X dle modulů
};

type AdminModuleGroup = 'Obsah' | 'Komunita' | 'Provoz' | 'Finance' | 'Governance' | 'Systém';

type AdminNavItem = {
  id: string; // např. 'events'
  label: string;
  group: AdminModuleGroup;
  requiredPermission?: string; // např. 'can_view_events'
};
```

## 5.Server architecture diagram (If it includes backend services)
```mermaid
graph TD
  A["Client (React UI)"] --> B["Route Handlers / Server Actions"]
  B --> C["Service (Business logika)"]
  C --> D["Repository (Supabase SDK)"]
  D --> E["Supabase Postgres/Storage/Auth"]

  subgraph "Server"
    B
    C
    D
  end
```

## 6.Data model(if applicable)
### 6.1 Data model definition
Konceptuálně (s důrazem na role/opr.)
```mermaid
erDiagram
  PROFILE ||--o{ ADMIN_AUDIT_LOG : "writes"
  PROFILE ||--o{ MEMBERSHIP_APPLICATION : "submits"
  MEMBERSHIP_APPLICATION ||--o| MEMBERSHIP_APPLICATION_PDF : "has"
  PROFILE ||--o{ QUEUE_ITEM : "creates"
  PROFILE ||--o{ NEWSLETTER_CAMPAIGN : "creates"
  NEWSLETTER_CAMPAIGN ||--o{ NEWSLETTER_DELIVERY : "delivers"

  PROFILE {
    uuid id
    string email
    boolean is_admin
    boolean is_member
  }

  MEMBERSHIP_APPLICATION {
    uuid id
    uuid profile_id
    string status
    datetime created_at
    datetime updated_at
  }

  MEMBERSHIP_APPLICATION_PDF {
    uuid id
    uuid application_id
    string storage_path
    datetime generated_at
  }

  QUEUE_ITEM {
    uuid id
    string type
    string status
    int attempts
    string last_error
    datetime run_after
    datetime created_at
  }

  NEWSLETTER_CAMPAIGN {
    uuid id
    string subject
    string status
    datetime scheduled_at
    datetime created_at
  }

  NEWSLETTER_DELIVERY {
    uuid id
    uuid campaign_id
    string recipient_email
    string status
    string last_error
    datetime sent_at
  }

  ADMIN_AUDIT_LOG {
    uuid id
    uuid actor_profile_id
    string action
    string entity
    datetime created_at
  }
```
