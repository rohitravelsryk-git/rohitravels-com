import * as React from 'react'

import { EmailButton, EmailHeading, EmailText, RohiEmailLayout } from './brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <RohiEmailLayout preview={`Confirm your email for ${siteName}`} category="SECURITY & AUTHENTICATION">
    <EmailHeading>Confirm your email</EmailHeading>
    <EmailText>Thanks for signing up for {siteName}. Confirm {recipient} to activate your secure access.</EmailText>
    <p><EmailButton href={confirmationUrl}>Verify email</EmailButton></p>
    <EmailText muted>If you did not create this account, you can safely ignore this message. Website: {siteUrl}</EmailText>
  </RohiEmailLayout>
)

export default SignupEmail

