import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'

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
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>You've been invited</Heading>
        <Text style={text}>
          You've been invited to join{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Click the button below to accept the invitation and create your
          account.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Accept Invitation
        </Button>
        <Text style={footer}>
          If you weren't expecting this invitation, you can safely ignore this
          email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: "Georgia, 'Times New Roman', serif" }
const container = { padding: '32px 28px', maxWidth: '560px', border: '1px solid #e6e1d6', borderTop: '5px solid #e8b44a', borderRadius: '12px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0d1a35', margin: '0 0 8px', letterSpacing: '-0.2px' }
const text = { fontSize: '15px', color: '#3f4657', lineHeight: '1.6', margin: '0 0 22px', fontFamily: 'Arial, sans-serif' }
const link = { color: '#0d1a35', textDecoration: 'underline' }
const button = { backgroundColor: '#e8b44a', color: '#0d1a35', fontSize: '14px', fontWeight: 'bold' as const, letterSpacing: '0.6px', textTransform: 'uppercase' as const, borderRadius: '999px', padding: '14px 26px', textDecoration: 'none', fontFamily: 'Arial, sans-serif' }
const footer = { fontSize: '12px', color: '#8a8f9c', margin: '30px 0 0', borderTop: '1px solid #eeeae0', paddingTop: '16px', fontFamily: 'Arial, sans-serif' }
