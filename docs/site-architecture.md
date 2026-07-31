# TAWD — Website Architecture

Enterprise multi-page site, not a landing page. Written before any code.

**Current state:** 6 routes (`/`, `/product`, `/pricing`, `/faq`, `/about`, `/contact`) plus `/legal/*`.
**Target:** 28 routes across 8 sections.

---

## 1. The honesty audit — decided first, because it changes the map

Half the requested tree describes a company with customers, a content team and a
hiring pipeline. TAWD has none of those yet. A page that exists and is empty
costs more than a page that does not exist: it is the first thing a prospect
finds when they go looking for proof.

Every page is therefore classified before it is designed.

| Page | Material available today | Decision |
|---|---|---|
| Home, Products, Solutions, AI, Pricing, Contact, Security, FAQ | Real | **Build** |
| Changelog | 159 real commits | **Build** — strongest unexpected asset |
| API Docs | 4 live endpoints | **Build**, scoped to what exists |
| Documentation, Help Center | Product knowledge exists, unwritten | **Build shell**, fill over time |
| Vision | Founder's, real | **Build** |
| About | Exists | **Keep** |
| **Customers / Success Stories / Testimonials** | **Zero customers** | **Do not build.** Replaced by *Early Access* |
| **Blog** | **Zero posts** | **Do not build.** A blog with one stale post dates the company |
| **Careers** | **No open roles** | **Do not build** |
| **Press** | **No coverage** | **Do not build** |
| **Partners** | **No partners** | **Do not build** |

**Rule:** nothing ships in the navigation that cannot survive a click.

Four of these become buildable the moment there is material, and the
architecture leaves their slots reserved rather than pretending.

---

## 2. Route map

```
app/(site)/
│
├─ layout.tsx                      shell · nav · footer · LangProvider
├─ page.tsx                        Home
│
├─ products/
│   ├─ page.tsx                    Overview — the portfolio
│   ├─ clinic/page.tsx             TAWD Clinic (replaces /product)
│   └─ roadmap/page.tsx            What is being built next
│
├─ solutions/
│   ├─ page.tsx                    Index — pick your practice
│   └─ [sector]/page.tsx           ONE file, five sectors:
│                                    dental · dermatology · plastic-surgery
│                                    medical-centers · multi-branch
│
├─ ai/page.tsx                     AI Platform — Sura, agents, voice, safety
│
├─ pricing/page.tsx                Existing, extended
│
├─ security/page.tsx               Isolation · audit · data ownership
│
├─ resources/
│   ├─ page.tsx                    Hub
│   ├─ docs/page.tsx               Documentation index
│   ├─ docs/[slug]/page.tsx        ONE file, N articles
│   ├─ api/page.tsx                API reference
│   ├─ changelog/page.tsx          Generated from git history
│   └─ faq/page.tsx                Existing, moved
│
├─ company/
│   ├─ about/page.tsx              Existing, moved
│   └─ vision/page.tsx             Where this is going
│
├─ early-access/page.tsx           Replaces "Customers"
├─ contact/page.tsx                Existing
└─ legal/{privacy,terms,data-deletion}   Existing
```

**28 routes from 19 files.** `solutions/[sector]` and `resources/docs/[slug]` are
dynamic: adding a sector or an article is a data entry, not a new page.

### Redirects (old URLs must not 404)
| From | To |
|---|---|
| `/product` | `/products/clinic` |
| `/faq` | `/resources/faq` |
| `/about` | `/company/about` |

---

## 3. Content architecture

The current `dict.ts` is one file holding every string on the site. At 28 pages
it becomes a merge conflict with a thousand lines. It splits:

```
lib/site/
├─ fonts.ts                  unchanged
├─ i18n.ts                   Lang type, useSite, dictionary assembly
└─ content/
    ├─ common.ts             nav · footer · buttons · shared labels
    ├─ home.ts
    ├─ products.ts
    ├─ solutions.ts          keyed by sector slug
    ├─ ai.ts
    ├─ pricing.ts
    ├─ security.ts
    ├─ company.ts
    ├─ resources.ts
    └─ docs/*.ts             one per article
```

**Shape — every file follows it:**

```ts
export const home = {
  ar: { … },
  en: { … },
} as const;
```

**Why a typed object and not a CMS.** There is one author. A CMS adds a service,
a schema, a build-time fetch and a failure mode, to save an editor who does not
exist. When there is a content team, `content/` maps onto a CMS in an afternoon
because the shape is already page-scoped.

**Bilingual stays a toggle**, not `/ar` + `/en` routes: 28 routes would become
56, and a reader who switches language would lose their place on the page.

---

## 4. Component architecture — the part that makes 28 pages possible

Pages must not each invent their own layout. Every page composes from one small
set of section primitives.

```
components/site/
│
├─ chrome/
│   ├─ nav.tsx               mega-menu, sticky, glass on scroll
│   ├─ mega-panel.tsx        the dropdown column layout
│   ├─ footer.tsx            5-column enterprise footer
│   └─ lang-toggle.tsx
│
├─ sections/                 ← every page is built from these
│   ├─ page-hero.tsx         eyebrow · h1 · lede · CTAs   (all inner pages)
│   ├─ feature-row.tsx       screen ↔ claim, alternating
│   ├─ card-grid.tsx         2/3/4-up, icon + title + body
│   ├─ stat-bar.tsx          counters
│   ├─ split-list.tsx        copy one side, checklist the other
│   ├─ compare-table.tsx     plan / sector comparison
│   ├─ faq-list.tsx          accordion
│   ├─ logo-row.tsx          infrastructure strip
│   ├─ quote-block.tsx       reserved — needs a real customer
│   └─ cta-band.tsx          closing action
│
├─ interactive/              ← the pieces that make it feel alive
│   ├─ product-panel.tsx     the hero dashboard (now interactive — §5)
│   ├─ roi-calculator.tsx    existing
│   ├─ sura-demo.tsx         NEW — type a message, watch it book
│   └─ counter.tsx           existing
│
├─ objects/                  isometric SVG art
│   ├─ layers.tsx  shield.tsx  cards.tsx        existing
│   └─ chip.tsx  network.tsx  brain.tsx         new, same 30° projection
│
└─ primitives/
    ├─ reveal.tsx   button.tsx   pill.tsx   panel.tsx
```

**The test this design has to pass:** a new Solutions sector should be
*one content object* and *zero new components*. If it needs a new component, the
primitive set is wrong.

---

## 5. The hero panel — from picture to instrument

The current panel is composed HTML and sharp, but static. It becomes the
site's interactive centrepiece:

| Interaction | What it does |
|---|---|
| **Tabs** | Dashboard · Appointments · Finance · Inventory — real panel switching, not images |
| **Live clock** | Appointment times computed from now, in Asia/Muscat |
| **Sura demo** | Type into the assistant card, watch a row appear in the schedule behind it |
| **Hover** | KPI tiles reveal their trend line |
| **Pointer** | Panel turns a few degrees, glare follows |

The Sura demo is the important one: it is the product's whole argument, and
letting a visitor drive it is worth more than any screenshot.

---

## 6. Navigation

A five-item bar plus two actions. Products, Solutions and Resources open mega
panels; AI, Pricing and Security are direct links.

```
[TAWD]   Products▾  Solutions▾  AI  Pricing  Security  Resources▾  Company▾    [ع|EN] [Contact] [Book a demo]
```

**Mega panel — Products**

| Column 1 | Column 2 |
|---|---|
| **Products** — Overview · TAWD Clinic · Roadmap | **Highlight card** — Sura, with the isometric object |

Mobile: full-screen drawer, sections collapsed by default.

---

## 7. Page specifications

Each page below lists the sections it composes, in order. Sections come from
§4 — nothing bespoke.

**Home** — hero+panel · infra strip · tri-cards · stats · problem · flow ·
3× feature-row · ROI · modules · FAQ · CTA

**Products / Overview** — page-hero · product cards (Clinic live, next ones
marked *in development*, honestly) · infra strip · CTA

**Products / TAWD Clinic** — page-hero · module grid (10 modules) · 3×
feature-row · split-list · FAQ · CTA

**Products / Roadmap** — page-hero · timeline (shipped / building / next) ·
CTA. Sourced from real work, marked by state.

**Solutions / index** — page-hero · sector card grid · CTA

**Solutions / [sector]** — page-hero (sector-specific) · "what it changes for
you" split-list · 2× feature-row · sector FAQ · CTA
Sectors: `dental` · `dermatology` · `plastic-surgery` · `medical-centers` ·
`multi-branch`

**AI Platform** — page-hero · Sura live demo · capability grid (books · voice ·
bilingual · memory · escalation · limits) · "how it decides" flow · safety
split-list · CTA

**Pricing** — page-hero · what's always included / modules · comparison table ·
pricing FAQ · CTA

**Security** — page-hero · isolation explained (RLS at the database, not the UI) ·
audit log · data ownership · infrastructure · incident honesty · CTA
*The strongest unbuilt page: every claim on it is true and checkable.*

**Resources / hub** — page-hero · card grid linking docs, API, changelog, FAQ

**Resources / Docs** — sidebar + article, `[slug]` driven

**Resources / API** — endpoint reference for the 4 live routes, with real
request/response shapes

**Resources / Changelog** — reverse-chronological, grouped by month, generated
from git history

**Company / About** — existing, restyled

**Company / Vision** — page-hero · long-form · principles · CTA

**Early Access** — page-hero · what a first clinic gets · what is expected in
return · form. Replaces the Customers page honestly.

---

## 8. Design system

Locked from the reference and applied everywhere.

| Token | Value |
|---|---|
| Background | `#050509` → `#0b1020` |
| Panel | `#0d1424` |
| Accent | `#2563eb`, lit `#4f8bff` |
| Text | `#fff` → `#c4cbdb` → `#8e97ac` → `#5d667c` |
| Radius | 14px panels · 20px large · 11px buttons |
| Max width | 1320px |
| Section rhythm | `clamp(3.5rem, 6.5vw, 6.5rem)` |

**Density rule** — the recurring complaint has been empty space. Every section
must carry either a visual object, a data figure, or an interaction. A section
that is a heading and a paragraph merges into its neighbour.

---

## 9. Build order

| Phase | Pages | Why first |
|---|---|---|
| **1** | Nav mega-menu · section primitives · route skeleton + redirects | Nothing else is possible until pages compose from one set |
| **2** | Security · AI Platform | Highest-value, entirely true, no blockers |
| **3** | Products (3) · Solutions (index + 5 sectors) | Volume from one dynamic route |
| **4** | Interactive panel + Sura demo | The centrepiece; needs the primitives settled |
| **5** | Resources: changelog · API · docs shell | Depth signals |
| **6** | Vision · Early Access · pricing comparison | Completes the map |

---

## 10. Open decisions

1. **`/product` → `/products/clinic`** — confirm the redirect is wanted.
2. **Early Access vs Customers** — confirm replacing the customers page rather
   than shipping an empty one.
3. **Docs depth** — shell now and fill later, or wait until articles exist?
4. **Founder portrait** — `public/founder.jpg` still missing; About shows
   initials until it lands.
