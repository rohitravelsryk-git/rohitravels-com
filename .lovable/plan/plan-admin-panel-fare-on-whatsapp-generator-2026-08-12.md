# Plan - Admin Panel "Fare on WhatsApp" Generator

Add a central admin button to bulk-update all group fares to "FARE ON WHATSAPP". This update will be gated by a configurable time interval to prevent accidental or premature updates.

## User Review Required

> [!IMPORTANT]
> The "time interval" setting will determine how long the button stays disabled after the last bulk update. What duration (e.g., 1 hour, 6 hours) would you prefer as the default?

- **Button Placement**: The "Generate WhatsApp Fare" button will be added to the Group Fares header, next to the "Add Fare" button.
- **Interval Control**: A new "Update Interval (minutes)" field will be added to the Backup & Recovery or Settings tab.

## Proposed Changes

### Database & Backend
- Add `last_whatsapp_fare_update` and `whatsapp_fare_interval` to the `site_settings` table via migration.
- Create `bulkUpdateFaresToWhatsApp` server function in `src/lib/fares.functions.ts`.
- Update `getPsf` to also return the last update timestamp and interval.

### Admin Panel UI
- **Group Fares Tab**: Add a button "📞 Set WhatsApp Fares" with a countdown timer if the interval hasn't passed.
- **Logic**: When clicked, it sets `price_text = "FARE ON WHATSAPP"` for every record in the `fares` table.
- **Settings**: Add a field to control the interval (in minutes) so admins can adjust how often this can be run.

## Technical Details
- **Migration**:
    ```sql
    INSERT INTO site_settings (key, value) VALUES ('whatsapp_fare_interval', '60') ON CONFLICT DO NOTHING;
    INSERT INTO site_settings (key, value) VALUES ('last_whatsapp_fare_update', '1970-01-01T00:00:00Z') ON CONFLICT DO NOTHING;
    ```
- **Validation**: The server function will verify that `now - last_update > interval` before proceeding.
- **Frontend**: Use `setInterval` to refresh the button state (enabled/disabled) based on the remaining time.
