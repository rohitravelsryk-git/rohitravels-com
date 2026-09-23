# Rohi Warm Clay Email System

## Goal
Apply one responsive, email-safe Rohi Warm Clay design to every authentication and operational email, then add the requested reusable templates without changing existing delivery or business workflows.

## Build
- Create shared email primitives for the terracotta header, paper-cream body, matte-black footer, buttons, status badges, detail rows, metric cards, attachment chips, and Outlook-safe tables.
- Include the Rohi support phone/email and social links in the shared footer, using the contact details already present in the project.
- Migrate all existing authentication templates: signup, invitation, magic link, password recovery, email change, reauthentication, and login/booking OTP.
- Migrate existing agent registration, approval, booking, payment, ticket, and internal notification emails away from legacy navy/gold styling.
- Add and register the requested B2B, admin/staff, traveler, security, settlement, package, hotel, visa, schedule-change, feedback, fraud, TTL, deposit, and team-invitation templates.
- Preserve current subjects, recipients, approvals, OTP rules, attachments, admin gates, and ticket-confirmation behavior.

## Technical details
- Use React Email with inline styles, table layouts, a 600px maximum width, and a mobile media query for 20px padding/full-width rendering.
- Escape all dynamic values and keep action URLs supplied by trusted server workflows.
- Register every new template for preview and typed sending through the existing managed email service.
- Keep `email.rohitravels.com` as the sender domain; add no database tables, queues, secrets, or third-party provider.

## Verification
- Render every registered template using preview data.
- Check output for deprecated navy/gold colors and missing required brand sections.
- Run the project type check and confirm existing email send paths still compile.
