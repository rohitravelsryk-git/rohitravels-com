import * as React from 'react'
import {
  AttachmentChip,
  DetailTable,
  EmailButton,
  EmailHeading,
  EmailText,
  MetricGrid,
  OtpBox,
  RohiEmailLayout,
  StatusBadge,
} from './brand'

export interface BrandedEmailProps {
  recipientName?: string
  intro?: string
  status?: string
  details?: Array<[string, string]>
  metrics?: Array<[string, string]>
  actionUrl?: string
  secondaryUrl?: string
  attachmentUrl?: string
  otp?: string
  remarks?: string
}

export interface BrandedEmailDefinition {
  category: string
  title: string
  preview: string
  intro: string
  actionLabel?: string
  secondaryLabel?: string
  attachmentLabel?: string
}

export function createBrandedEmail(definition: BrandedEmailDefinition) {
  return function BrandedTransactionalEmail(props: BrandedEmailProps) {
    const intro = props.intro ?? definition.intro
    return (
      <RohiEmailLayout preview={definition.preview} category={definition.category}>
        <EmailHeading>{definition.title}</EmailHeading>
        {props.status ? <StatusBadge>{props.status}</StatusBadge> : null}
        {props.recipientName ? <EmailText>Dear {props.recipientName},</EmailText> : null}
        <EmailText>{intro}</EmailText>
        {props.otp ? <OtpBox code={props.otp} /> : null}
        {props.metrics?.length ? <MetricGrid metrics={props.metrics} /> : null}
        {props.details?.length ? <DetailTable rows={props.details} /> : null}
        {definition.attachmentLabel && props.attachmentUrl ? <p><AttachmentChip label={definition.attachmentLabel} href={props.attachmentUrl} /></p> : null}
        {definition.actionLabel && props.actionUrl ? <p><EmailButton href={props.actionUrl}>{definition.actionLabel}</EmailButton></p> : null}
        {definition.secondaryLabel && props.secondaryUrl ? <p><EmailButton href={props.secondaryUrl} secondary>{definition.secondaryLabel}</EmailButton></p> : null}
        {props.remarks ? <EmailText muted>{props.remarks}</EmailText> : null}
      </RohiEmailLayout>
    )
  }
}

export const TRANSACTIONAL_DEFINITIONS = {
  agent_registration_received: { category: 'B2B AGENT PORTAL', title: 'Registration received', preview: 'Your agency registration is under KYC review', intro: 'We received your agency registration. Our team is reviewing your KYC information and will notify you after verification.', actionLabel: 'View application' },
  agent_account_approved: { category: 'B2B AGENT PORTAL', title: 'Your agent account is active', preview: 'Your Rohi B2B agent account has been approved', intro: 'Your agency account is approved and ready. Use the credentials and Agent ID below to activate your access.', actionLabel: 'Activate account' },
  wallet_deposit_confirmed: { category: 'B2B AGENT PORTAL', title: 'Wallet deposit confirmed', preview: 'Your deposit has been credited', intro: 'Your bank deposit was verified and the credited balance is now available for bookings.', actionLabel: 'Open wallet' },
  deposit_verification_failed: { category: 'B2B AGENT PORTAL', title: 'Deposit verification needs attention', preview: 'Your deposit slip could not be verified', intro: 'We could not verify the submitted deposit. Review the remarks below and upload a corrected slip.', actionLabel: 'Upload new slip' },
  low_balance_alert: { category: 'B2B AGENT PORTAL', title: 'Low balance and credit limit alert', preview: 'Action recommended for your B2B account balance', intro: 'Your available balance is approaching the configured threshold while bookings remain pending.', actionLabel: 'Review account' },
  b2b_booking_confirmation: { category: 'B2B AGENT PORTAL', title: 'Booking confirmed and agent invoice', preview: 'Your booking is confirmed', intro: 'Your B2B booking has been confirmed. Review the PNR, net fare, and commission settlement below.', actionLabel: 'Open booking', attachmentLabel: 'PDF voucher' },
  ticket_credit_note: { category: 'B2B AGENT PORTAL', title: 'Ticket cancellation credit note', preview: 'Ticket void or cancellation settlement', intro: 'The ticket adjustment has been processed. The settlement and credit details are listed below.', attachmentLabel: 'PDF credit note' },
  team_member_invitation: { category: 'B2B AGENT PORTAL', title: 'You are invited to the agency team', preview: 'Activate your Rohi B2B team access', intro: 'An agency administrator assigned you a role in their Rohi B2B workspace.', actionLabel: 'Activate team access' },
  admin_agent_kyc_review: { category: 'ADMIN & STAFF OPERATIONS', title: 'New agent registration pending KYC', preview: 'A B2B agent application needs review', intro: 'A new agency submitted registration and KYC details for administrative review.', actionLabel: 'Review agent' },
  admin_deposit_review: { category: 'ADMIN & STAFF OPERATIONS', title: 'Bank deposit slip verification request', preview: 'A bank deposit slip needs verification', intro: 'An agent submitted an offline payment claim. Confirm the bank transaction before crediting the account.', actionLabel: 'Approve deposit', secondaryLabel: 'Reject deposit' },
  ttl_escalation: { category: 'ADMIN & STAFF OPERATIONS', title: 'Urgent ticketing time-limit alert', preview: 'Less than 60 minutes remain before ticketing expiry', intro: 'This booking is approaching its ticketing deadline and requires immediate action.', actionLabel: 'Open booking' },
  fraud_velocity_alert: { category: 'ADMIN & STAFF OPERATIONS', title: 'Suspicious booking velocity detected', preview: 'A booking pattern triggered fraud controls', intro: 'Automated risk rules detected unusually fast or repeated booking activity. Review before ticketing.', actionLabel: 'Review activity', secondaryLabel: 'Lock account' },
  daily_financial_digest: { category: 'ADMIN & STAFF OPERATIONS', title: 'Daily financial and settlement digest', preview: 'Today’s booking and settlement summary', intro: 'Here is the daily operational summary for sales, markup, issuance, and pending settlement.', actionLabel: 'Open accounts' },
  customer_flight_confirmation: { category: 'CUSTOMER & TRAVELER', title: 'Flight booking confirmation and e-ticket', preview: 'Your flight booking is confirmed', intro: 'Your flight is confirmed. Keep the PNR and itinerary below available throughout your journey.', attachmentLabel: 'PDF e-ticket' },
  umrah_package_confirmation: { category: 'CUSTOMER & TRAVELER', title: 'Umrah and Hajj package confirmation', preview: 'Your pilgrimage package itinerary is ready', intro: 'Your package is confirmed. Review hotel stays, transport arrangements, and the complete itinerary.', attachmentLabel: 'PDF itinerary' },
  hotel_confirmation: { category: 'CUSTOMER & TRAVELER', title: 'Hotel reservation and check-in voucher', preview: 'Your hotel reservation is confirmed', intro: 'Your accommodation is reserved. Present the attached voucher and booking reference at check-in.', attachmentLabel: 'Hotel voucher' },
  visa_status_update: { category: 'CUSTOMER & TRAVELER', title: 'Visa application status update', preview: 'There is an update on your visa application', intro: 'Your visa application status has changed. The latest consulate tracking details appear below.', actionLabel: 'Track application' },
  schedule_change: { category: 'CUSTOMER & TRAVELER', title: 'Flight schedule change', preview: 'Important change to your flight schedule', intro: 'The airline revised your schedule. Compare the original and revised details before responding.', actionLabel: 'Accept revised schedule', secondaryLabel: 'Request assistance' },
  post_travel_feedback: { category: 'CUSTOMER & TRAVELER', title: 'How was your journey?', preview: 'Share feedback about your recent trip', intro: 'We hope your journey went smoothly. Your feedback helps Rohi improve every traveler experience.', actionLabel: '★★★★★  Leave a review' },
  two_factor_code: { category: 'SECURITY & AUTHENTICATION', title: 'Your one-time passcode', preview: 'Your Rohi verification code', intro: 'Enter this one-time passcode to complete verification. It expires in 10 minutes and can be used once.' },
  password_reset_request: { category: 'SECURITY & AUTHENTICATION', title: 'Reset your password', preview: 'Password reset requested for your Rohi account', intro: 'Use the secure link below to choose a new password. If the button does not work, copy the fallback URL from the details.', actionLabel: 'Reset password' },
  new_device_notice: { category: 'SECURITY & AUTHENTICATION', title: 'New device or location sign-in', preview: 'New sign-in detected on your Rohi account', intro: 'We detected access from a new device or approximate location. Confirm whether this activity was yours.', actionLabel: 'This was me', secondaryLabel: 'Lock account' },
} satisfies Record<string, BrandedEmailDefinition>

export const TRANSACTIONAL_COMPONENTS = Object.fromEntries(
  Object.entries(TRANSACTIONAL_DEFINITIONS).map(([key, definition]) => [key, createBrandedEmail(definition)]),
) as Record<keyof typeof TRANSACTIONAL_DEFINITIONS, React.ComponentType<BrandedEmailProps>>