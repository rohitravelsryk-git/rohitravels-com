# Plan: Add Return Group Fare Support

I will implement a "Return Fare" option for Umrah group fares that allows admins to specify return flight details without changing the underlying database schema. This will be achieved by standardizing the `flight_details` field to hold multiple legs (Departure and Return) and updating the UI to handle these two components gracefully.

## Proposed Changes

### UI & UX Improvements
- **Admin Panel Add/Edit Fare**:
  - Add a "Return Fare" toggle checkbox in the "Add New Group Fare" and "Edit Fare" modals.
  - When enabled, a second "Return Flight Details" textarea will appear.
  - The "Flight Details" field will be renamed to "Departure Flight Details".
  - These two fields will be combined into a single `flight_details` string using a canonical separator (e.g., a visual divider or specific line break pattern) when saved.
- **Agent B2B Portal**:
  - Detect "Return" fares by looking for return-specific patterns in `flight_details`.
  - Display return flights clearly in the fares table and booking modals.
  - The "COPY" functionality will include the full return itinerary.
- **Public Homepage**:
  - Ensure return itineraries are rendered clearly in the hero section and fare cards.

### Logic & Formatting
- **Data Storage**:
  - Departure and Return legs will be stored in the existing `flight_details` text column.
  - I will use a double newline or a specific marker (e.g., `--- RETURN ---`) to separate them, ensuring backward compatibility with existing single-leg fares.
- **Fare Sharing**:
  - Update `buildFareShareText` to recognize and format return legs in the WhatsApp/Clipboard output.

## Technical Details

- **Files to Modify**:
  - `src/routes/admin.index.tsx`: Update the `Draft` type, Add/Edit modals, and payload builders.
  - `src/lib/fare-format.ts`: Update the canonical share text logic to handle multiple legs/segments.
  - `src/routes/_agentapp.agent.fares.tsx`: Update the agent-facing table and booking modal to display return details.
  - `src/routes/index.tsx`: Update the public homepage hero and cards to render multi-line itineraries.

## User Review Required
> [!IMPORTANT]
> This approach keeps your existing database structure and manifests intact. The "Return" status is inferred from the content, which is safer and faster to implement than a database migration.

- I will add a "Return Fare" toggle in the admin panel.
- I will make sure the WhatsApp share text looks professional for return journeys.
- I will ensure existing "One Way" fares are not affected.
