import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your login link for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your login link</Heading>
        <Text style={text}>
          Click the button below to log in to {siteName}. This link will expire
          shortly.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Log In
        </Button>
        <Text style={footer}>
          If you didn't request this link, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

import { brandStyles } from "./styles";
const main = { backgroundColor: '#f8f4ee', fontFamily: brandStyles.text.fontFamily };
const container = brandStyles.container;
const h1 = brandStyles.h1;
const text = brandStyles.text;
const button = brandStyles.button;
const footer = brandStyles.footer;
const footer = { fontSize: '12px', color: '#8a8f9c', margin: '30px 0 0', borderTop: '1px solid #eeeae0', paddingTop: '16px', fontFamily: 'Arial, sans-serif' }
