import * as React from 'react'

import { EmailHeading, EmailText, OtpBox, RohiEmailLayout } from './brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <RohiEmailLayout preview="Your verification code" category="SECURITY & AUTHENTICATION">
    <EmailHeading>Confirm your identity</EmailHeading>
    <EmailText>Use this one-time passcode to complete reauthentication.</EmailText>
    <OtpBox code={token} />
    <EmailText muted>This code expires shortly. Never share it with anyone.</EmailText>
  </RohiEmailLayout>
)

export default ReauthenticationEmail

