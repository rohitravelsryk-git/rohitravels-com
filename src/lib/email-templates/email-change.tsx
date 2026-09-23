import * as React from 'react'

import { DetailTable, EmailButton, EmailHeading, EmailText, RohiEmailLayout } from './brand'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <RohiEmailLayout preview={`Confirm your email change for ${siteName}`} category="SECURITY & AUTHENTICATION">
    <EmailHeading>Confirm your email change</EmailHeading>
    <EmailText>Confirm the requested change to your {siteName} account.</EmailText>
    <DetailTable rows={[["Current email", oldEmail], ["New email", newEmail]]} />
    <p><EmailButton href={confirmationUrl}>Confirm email change</EmailButton></p>
    <EmailText muted>If you did not request this change, secure your account immediately.</EmailText>
  </RohiEmailLayout>
)

export default EmailChangeEmail

