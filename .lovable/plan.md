# B2B Agent Portal: navigation, Book Now scope, and booking row format

## 1. One shared top navigation bar for the whole agent portal

Today the agent portal keeps its menu in the left sidebar, and the Print Tickets page shows only two buttons ("Back to Group Fares", "Dashboard") in its header. Fix by creating one shared component `src/components/AgentTopBar.tsx` that renders the full agent menu as a horizontal tab row in the header:

Homepage · Dashboard · Group Fares · All Group Bookings · Print Tickets · Ledger · My Profile · Change Password · Latest Updates · agency avatar menu (Sign out)

- Active tab highlighted (gold underline / gold pill on navy) — same navy/gold + serif typography used elsewhere.
- Used by both `src/routes/_agentapp.tsx` (portal layout) and `src/routes/print-format.tsx` when `?portal=agent`, so Print Tickets gets the identical header tabs plus the existing sidebar.
- Tabs live in the header only; nothing moves to a footer. Sidebar stays for the grouped tree.
- No Admin link, Admin Panel button, `AdminTabs`, or `AdminHeaderExtras` renders anywhere in the agent portal (audit `print-format.tsx` and `SiteHeader.tsx` for leaks).
- Adding a future agent tab = one entry in the component's tab array, so new tabs inherit the same colors/typography/layout automatically.

## 2. Book Now must use only the clicked fare row

Currently `BookingModal` collects every fare with the same airline + origin + destination, so booking the 21 AUG Karachi–Jeddah fare also offers 25 AUG. Change:

- Pass only the clicked fare to `BookingModal`; drop the `allFares` sibling lookup.
- Build options from that single row's `flight_details` using the existing `splitFlightOptions` (connecting legs stay grouped inside their date).
- If that row yields one date → skip the date-picker step and go straight to the Book Fare form. Show the picker only when the row itself contains two or more distinct travel dates.

## 3. "Airline / Flight Details" cell in All Group Bookings

Re-format the cell in `src/routes/_agentapp.agent.bookings.tsx` to:

```text
KHI → SHJ
Airarabia
10 AUG KHI SHJ 1045 1205
Fare: FARE ON WHATSAPP
Bag: 20+10 KG
```

- Line 1: bold route with IATA codes and arrow.
- Line 2: airline name only (no IATA codes).
- Line 3+: flight segments, one per line, monospace.
- Fare line keeps its orange emphasis; the `Bag:` line renders in black (`text-foreground`) instead of orange.

## Technical notes

- New file: `src/components/AgentTopBar.tsx`.
- Edited: `src/routes/_agentapp.tsx`, `src/routes/print-format.tsx`, `src/routes/_agentapp.agent.fares.tsx`, `src/routes/_agentapp.agent.bookings.tsx`.
- Presentation and client-side logic only; no schema or server-function changes.
