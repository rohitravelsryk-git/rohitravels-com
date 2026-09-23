import * as React from 'react'

import { EmailButton, EmailHeading, EmailText, RohiEmailLayout } from './brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <RohiEmailLayout preview={`Your login link for ${siteName}`} category="SECURITY & AUTHENTICATION">
    <EmailHeading>Your secure login link</EmailHeading>
    <EmailText>Use this one-time link to sign in to {siteName}. It will expire shortly.</EmailText>
    <p><EmailButton href={confirmationUrl}>Log in securely</EmailButton></p>
    <EmailText muted>If you did not request this link, you can safely ignore this email.</EmailText>
  </RohiEmailLayout>
)

export default MagicLinkEmail

