# AgroLoopCI Workspace

## Overview

Full-stack PWA B2B marketplace connecting agricultural producers with agro-industrial waste buyers/processors in Côte d'Ivoire.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS (artifacts/agroloop) — PWA-ready
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Map**: Leaflet.js + react-leaflet
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Schema

### Tables
- **users** — User accounts with roles (producteur | transformateur)
- **residus** — Agricultural waste offers with geolocation; `livraison_possible` boolean toggles whether the seller can deliver to the buyer
- **transactions** — Purchase transactions between buyers and sellers. Has a `source` enum (`devis` | `commande` | `directe`) plus optional FKs (`devisId`, `orderId`, `orderItemId`) tracing the origin of the transaction. All three flows (direct purchase, cart order item acceptance, devis acceptance) converge here.
- **contracts** — Auto-generated PDF purchase orders with electronic signatures (1:1 with confirmed transactions, via `generateContractForTransaction(txId)`)

## Unified Transaction Flow

Three user paths lead to a confirmed transaction, all unified through the `transactions` table + `source` column:
1. **Devis** (offer-for-price): `devis.accepted` → transaction with `source='devis'`, `devisId` set.
2. **Commande groupée (panier)**: Transformateur adds items to cart → submits order → producteur accepts each `orderItem` → transaction with `source='commande'`, `orderId`/`orderItemId` set.
3. **Commande directe**: transformateur posts directly to `POST /api/transactions` → `source='directe'`.

Shared surfaces:
- `GET /api/dashboard/pending-counts` — role-aware counts (transformateur: cart, devis, orders, counter-proposals; producteur: devis, orders, + `expiringSoon` for order items < 6h from 48h deadline). Drives `<PendingActionsWidget>` on both dashboards.
- `GET /api/offres/buyer-states` — returns `Record<offreId, { inCart, activeDevisId?, activeOrderId? }>`. Drives the marketplace's 3-button state-aware footer (🛒 panier / 📋 devis / 💬 contact) with mutually-exclusive "in progress" states replacing the primary button.
- `GET /api/transactions/historique` — unified confirmed-transaction list with `source` + `devisReference`/`orderReference` joined. Rendered by `/historique` page with source badges ("Via devis", "Via panier", "Commande directe").
- Layout user dropdown (desktop + mobile sheet) links to Mes commandes, Mes devis/Devis reçus/Commandes reçues (role-aware), Historique, Préférences, Déconnexion.

## Onboarding

After registration, producteurs and transformateurs see a 3-step guided checklist (`<OnboardingChecklist />`) at the top of their dashboard, with a visible progress bar:
1. Compléter votre profil (téléphone + région)
2. Producteur: publier la 1ère offre — Transformateur: lancer la 1ère recherche (visite de `/marketplace`, persistée via `localStorage.agroloop_did_search`)
3. Démarrer une 1ère conversation (≥ 1 conversation côté API)

Auto-hides on completion (after a "Bravo" celebration), or dismissable via the X button (persisted per user in `localStorage`).

## Routes

### Frontend (artifacts/agroloop)
- `/` — Landing page with platform stats
- `/register` — User registration with role selection
- `/login` — Login
- `/marketplace` — Browse/search available offers
- `/carte` — Interactive Leaflet map of offers
- `/offres/nouvelle` — Publish new offer (producteur only)
- `/dashboard/producteur` — Producteur dashboard
- `/dashboard/transformateur` — Transformateur dashboard

### API (artifacts/api-server)
- `POST /api/auth/register` — Register
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Get current user
- `GET /api/offres` — List offers (with filters)
- `POST /api/offres` — Create offer (producteur)
- `GET /api/offres/map` — Map data
- `GET /api/offres/mes-offres` — My offers
- `GET/PUT/DELETE /api/offres/:id` — CRUD
- `POST /api/transactions` — Create transaction (transformateur)
- `GET /api/transactions/mes-achats` — My purchases
- `GET /api/transactions/mes-ventes` — My sales
- `GET /api/stats` — Public platform stats
- `GET /api/dashboard/producteur` — Producteur dashboard data
- `GET /api/dashboard/transformateur` — Transformateur dashboard data
- `GET /api/admin/finance/metrics?months=N` — MRR series, 3-month forecast, churn series, Pro/Business segment LTV
- `GET /api/invoices/:id/download` — PDF facture (CI fiscal compliant: RCCM/NCC, HT/TVA/TTC, mentions légales)

## Seed Data
- 3 producteurs: bernard@example.com, marie@example.com, karim@example.com
- 2 transformateurs: kone@example.com, ecoagro@example.com
- All passwords: password123
- 10 sample offers across Abengourou, San Pedro, Bouaké, Abidjan, Korhogo, Yamoussoukro

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (auto-managed by Replit)
- `JWT_SECRET` — JWT signing secret
- `SESSION_SECRET` — Session secret

## Photo Upload (Offer Photos)
- Table `offer_photos` (FK CASCADE on `residus.id`): id, offre_id, file_url, thumbnail_url, file_name, is_cover, position, uploaded_at
- Min 2 / max 6 photos per offer; processed server-side with sharp (1200px webp full + 400px webp thumbnail), stored as base64 data URLs
- Endpoints: `POST /api/offres` requires `body.photos: string[]`; `PUT /api/offres/:id` accepts `photos` (add) + `deleted_photo_ids` (remove); `GET /api/offres` returns `cover_photo_url` + `photo_count`; `GET /api/offres/:id` returns `photos[]`; standalone `/offres/:id/photos` (GET, POST, DELETE :photoId, PUT /reorder)
- Frontend: `<PhotoUploader>` (drag/drop, mobile camera capture, reorder, cover badge); marketplace cards show cover + count; `/offre/:id` detail page with lightbox gallery; map popups show 80×80 thumbnail
- Create-offer is wrapped in a DB transaction so an offer cannot be persisted without its photos

## Quote Requests (Devis)
- Table `devis` — 7-state enum: `en_attente`, `accepté`, `refusé`, `contre_proposé`, `contre_proposé_accepté`, `contre_proposé_refusé`, `expiré`
- Reference format: `DEV-AGRL-YYYY-XXXXXX` (alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`)
- 48h auto-expiry via hourly cron (`runDevisExpiryCheck`) — expires both `en_attente` and `contre_proposé` states and notifies the waiting party
- Partial unique index `devis_unique_active_per_offre` on `(offre_id, transformateur_id) WHERE status IN ('en_attente','contre_proposé')` prevents duplicate active devis (race-safe)
- Accept / counter-accept are fully atomic in `atomicallyAcceptDevis` (single DB transaction):
  - CAS state transition (`UPDATE ... WHERE id=? AND status=? AND expires_at>=NOW() RETURNING`)
  - Conditional stock decrement (`UPDATE residus SET quantity_kg = quantity_kg - N WHERE quantity_kg >= N`)
  - Transaction row insert with `status=confirmée`
  - Returns 409 on state change / stock insufficient / expiry race
  - Contract PDF generation is fired async after commit (non-blocking)
- Endpoints under `/api/devis/*`:
  - `POST /api/devis` (transformateur) · `GET /api/devis/mes-devis` · `GET /api/devis/recus` (producteur)
  - `GET /api/devis/:id` · `GET /api/devis/offre/:offreId/active`
  - `PUT /api/devis/:id/{accepter,refuser,contre-proposer}` (producteur)
  - `PUT /api/devis/:id/contre-proposer/{accepter,refuser}` (transformateur)
- Frontend: `/devis/mes-devis` (transformateur list), `/devis/recus` (producteur list), `/devis/:id` (detail + actions); shared `<DevisModal>` used in marketplace & offre-detail
- Notifications reuse existing enum types: `offre_correspondante` (new/counter), `transaction_confirmee` (accepted), `transaction_annulee` (refused), `offre_expiree` (expiry)

## Multi-Vendor Cart & Orders

Transformateurs build a cart of residus from multiple producteurs and place a single grouped order.
- Tables: `cart_items` (unique per user+offre), `orders` (reference `CMD-AGRL-YYYY-XXXX`), `order_items` (one per seller, holds state + optional counter-proposal)
- Cart routes: GET/POST/PUT/DELETE at `/api/cart`, `/api/cart/add`, `/api/cart/items/:offreId`, `/api/cart/clear`, `/api/cart/count`
- Order routes: POST `/api/orders` (validates offers, creates order+items, clears cart atomically, notifies sellers), GET `/api/orders` (list for transformateur), GET `/api/orders/received` (producteur's items), GET `/api/orders/:id`, PUT `/api/orders/items/:itemId/respond` (producteur: accepter/refuser/contre_proposer), PUT `/api/orders/items/:itemId/counter-respond` (transformateur: accept/refuse counter)
- 48h auto-expiry via cron (`runOrderExpiryCheck`) — expires `en_attente` and `contre_proposée` items
- Accept is fully atomic (`atomicallyAcceptOrderItem`): CAS state transition + conditional stock decrement + transaction insert in a single DB tx; async contract PDF generation after commit
- Order status auto-recomputed after each item response: `annulée` if all refused, `confirmée` if all non-pending, `partiellement_confirmée` if mixed
- Frontend: `/panier` (cart grouped by seller, quantity steppers), `/commandes` (transformateur list), `/commandes/:id` (detail with counter-proposal UI), `/commandes/confirmation/:id`, `/commandes/recues` (producteur, filter tabs, respond dialogs); `<AddToCartModal>` on marketplace cards; `<CartBadge>` in navbar

## Important Notes
- The codegen script patches `lib/api-zod/src/index.ts` after orval to avoid duplicate exports
- The orval zod config uses `mode: "single"` to avoid types folder duplication
- Leaflet map markers are colored by residu type
- WhatsApp contact button uses wa.me URL with pre-filled message
- Seed users use bcryptjs hash for "password123"

## Analytics System (April 2026)

### Database Tables
- **page_views** — Every API GET request: path, session_id (cookie UUID), device_type, user_id (nullable), region, referrer
- **offer_views** — Per-offer view tracking (linked to residus + viewer user)
- **conversion_events** — Funnel steps: visit | register | first_offer | first_contact | first_transaction | subscription

### Backend
- `analyticsMiddleware` (api-server/src/middlewares/analytics.ts) — Applied to all `/api` routes, fire-and-forget page_views insert, sets `agro_sid` cookie (30-min session UUID)
- Specific tracking inserted in: auth/register (→ `register`), offres POST (→ `first_offer`), conversations POST (→ `first_contact`)
- Admin routes: `GET /api/admin/analytics/overview`, `/traffic`, `/realtime`, `/conversions`

### Frontend
- `src/lib/analytics.ts` — GA4 helper (consent-gated): `initAnalytics`, `trackPageView`, `trackEvent`
- `src/components/cookie-consent.tsx` — GDPR banner; stores choice in localStorage `analytics_consent`; enables/disables GA4
- `RouteTracker` component in App.tsx — tracks page view on every route change
- `VITE_GA_MEASUREMENT_ID` env var controls GA4 measurement ID
- Admin page `/admin/analytics` — full dashboard: realtime widget, KPI cards, traffic area chart, devices donut, top pages, regions, conversion funnel, peak hours bar chart, top offers, GA4 link, CSV export
- Analytics link added to admin sidebar under ADMINISTRATION

## Admin Console Layout (April 2026)
- `/admin/*` routes render with their own shell — `Layout` skips the public navbar/footer when route starts with `/admin/`
- `AdminLayout` provides:
  - Top bar: AgroLoopCI logo + "Console Admin" + notification bell + avatar dropdown (Mon profil admin / Voir le site / Déconnexion)
  - Grouped sidebar: GESTION (Vue/Users/Vérifs/Offres/Tx/Contracts) · MONÉTISATION (Abos/Finance/Moyens/Plans) · COMMUNAUTÉ (Avis/Support/Diffusion) · ADMINISTRATION (Équipe/Journal/Paramètres)
  - Items filtered by `hasPermission(resource, action)`; empty sections hidden
- Sidebar badges fed by `GET /api/admin/sidebar-badges` returning `{verifications_pending, subscriptions_pending, support_open}` — each metric is server-side permission-scoped (returns 0 if caller lacks the corresponding `view` permission)
- Paiements-config page now also exposes Contact Support settings (WhatsApp, Email, Heures) when caller has `settings.view`; Modifier buttons require `settings.edit`
