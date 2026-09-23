import * as React from 'react'

import { EmailButton, EmailHeading, EmailText, RohiEmailLayout } from './brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <RohiEmailLayout preview={`You've been invited to join ${siteName}`} category="SECURITY & AUTHENTICATION">
    <EmailHeading>You’ve been invited</EmailHeading>
    <EmailText>You have been invited to join {siteName}. Accept the invitation to create your secure account.</EmailText>
    <p><EmailButton href={confirmationUrl}>Accept invitation</EmailButton></p>
    <EmailText muted>If you were not expecting this invitation, ignore this message. Website: {siteUrl}</EmailText>
  </RohiEmailLayout>
)

export default InviteEmail

