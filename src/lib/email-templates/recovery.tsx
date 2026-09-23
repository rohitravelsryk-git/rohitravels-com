import * as React from 'react'

import { EmailButton, EmailHeading, EmailText, RohiEmailLayout } from './brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <RohiEmailLayout preview={`Reset your password for ${siteName}`} category="SECURITY & AUTHENTICATION">
    <EmailHeading>Reset your password</EmailHeading>
    <EmailText>We received a password reset request for {siteName}. Use the secure button below to choose a new password.</EmailText>
    <p><EmailButton href={confirmationUrl}>Reset password</EmailButton></p>
    <EmailText muted>Fallback URL: {confirmationUrl}. If you did not request this, your password remains unchanged.</EmailText>
  </RohiEmailLayout>
)

export default RecoveryEmail

