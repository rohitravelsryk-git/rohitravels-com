import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export const EMAIL_COLORS = {
  clay: '#D97757',
  ink: '#141413',
  paper: '#FAF9F5',
  linen: '#F4EFEA',
  charcoal: '#1C1917',
  muted: '#78716C',
  border: '#E7E5E4',
  white: '#FFFFFF',
} as const

const mobileCss = `
  @media screen and (max-width: 600px) {
    .rohi-shell { width: 100% !important; }
    .rohi-content { padding: 24px 20px !important; }
    .rohi-header, .rohi-footer { padding-left: 20px !important; padding-right: 20px !important; }
    .rohi-stack, .rohi-stack tbody, .rohi-stack tr, .rohi-stack td { display: block !important; width: 100% !important; box-sizing: border-box !important; }
    .rohi-stack td + td { padding-left: 0 !important; padding-top: 10px !important; }
    .rohi-button { display: block !important; box-sizing: border-box !important; width: 100% !important; text-align: center !important; }
  }
`

export interface RohiEmailLayoutProps {
  preview: string
  category: string
  children: React.ReactNode
}

export function RohiEmailLayout({ preview, category, children }: RohiEmailLayoutProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head><style>{mobileCss}</style></Head>
      <Preview>{preview}</Preview>
      <Body style={canvas}>
        <Container className="rohi-shell" style={shell}>
          <Section className="rohi-header" style={header}>
            <Text style={wordmark}>ROHI INTERNATIONAL TRAVELS</Text>
            <Text style={categoryStyle}>{category}</Text>
          </Section>
          <Section className="rohi-content" style={content}>{children}</Section>
          <Section className="rohi-footer" style={footer}>
            <Text style={footerBrand}>ROHI INTERNATIONAL TRAVELS</Text>
            <Text style={footerText}>
              Support: <Link href="tel:+923056622988" style={footerLink}>+92 305 6622988</Link>
              {' · '}
              <Link href="mailto:rohitravelsryk@gmail.com" style={footerLink}>rohitravelsryk@gmail.com</Link>
            </Text>
            <Text style={footerText}>
              <Link href="https://www.rohitravels.com" style={footerLink}>Website</Link>
              {' · '}
              <Link href="https://www.facebook.com/rohitravelsryk" style={footerLink}>Facebook</Link>
              {' · '}
              <Link href="https://www.instagram.com/rohitravels/" style={footerLink}>Instagram</Link>
              {' · '}
              <Link href="https://wa.me/923056622988" style={footerLink}>WhatsApp</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export function EmailHeading({ children }: { children: React.ReactNode }) {
  return <Text style={heading}>{children}</Text>
}

export function EmailText({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return <Text style={muted ? mutedText : bodyText}>{children}</Text>
}

export function EmailButton({ href, children, secondary = false }: { href: string; children: React.ReactNode; secondary?: boolean }) {
  return <Button className="rohi-button" href={href} style={secondary ? secondaryButton : primaryButton}>{children}</Button>
}

export function StatusBadge({ children }: { children: React.ReactNode }) {
  return <Text style={badge}>{children}</Text>
}

export function DetailTable({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <table role="presentation" cellPadding="0" cellSpacing="0" width="100%" style={detailsTable}>
      <tbody>{rows.map(([label, value], index) => (
        <tr key={`${label}-${index}`} style={{ backgroundColor: index % 2 === 0 ? EMAIL_COLORS.white : EMAIL_COLORS.paper }}>
          <td style={detailLabel}>{label}</td><td style={detailValue}>{value}</td>
        </tr>
      ))}</tbody>
    </table>
  )
}

export function MetricGrid({ metrics }: { metrics: Array<[string, string]> }) {
  return (
    <table role="presentation" cellPadding="0" cellSpacing="0" width="100%" className="rohi-stack" style={{ margin: '20px 0' }}>
      <tbody>{Array.from({ length: Math.ceil(metrics.length / 2) }, (_, rowIndex) => (
        <tr key={rowIndex}>{metrics.slice(rowIndex * 2, rowIndex * 2 + 2).map(([label, value]) => (
          <td key={label} width="50%" style={metricCell}>
            <Text style={metricLabel}>{label}</Text><Text style={metricValue}>{value}</Text>
          </td>
        ))}</tr>
      ))}</tbody>
    </table>
  )
}

export function AttachmentChip({ label, href }: { label: string; href?: string }) {
  return <Link href={href ?? '#'} style={attachment}>▣ {label}</Link>
}

export function OtpBox({ code }: { code: string }) {
  return <Text style={otp}>{code}</Text>
}

const canvas = { margin: '0', padding: '24px 10px', backgroundColor: EMAIL_COLORS.linen, fontFamily: 'Arial, Helvetica, sans-serif' }
const shell = { width: '100%', maxWidth: '600px', margin: '0 auto', backgroundColor: EMAIL_COLORS.paper, border: `1px solid ${EMAIL_COLORS.border}` }
const header = { backgroundColor: EMAIL_COLORS.clay, padding: '24px 32px' }
const wordmark = { margin: '0', color: EMAIL_COLORS.white, fontSize: '17px', lineHeight: '24px', fontWeight: '700' as const }
const categoryStyle = { margin: '4px 0 0', color: EMAIL_COLORS.white, fontSize: '12px', lineHeight: '18px' }
const content = { backgroundColor: EMAIL_COLORS.paper, padding: '32px' }
const heading = { margin: '0 0 14px', color: EMAIL_COLORS.ink, fontSize: '26px', lineHeight: '34px', fontWeight: '700' as const }
const bodyText = { margin: '0 0 16px', color: EMAIL_COLORS.charcoal, fontSize: '15px', lineHeight: '24px' }
const mutedText = { margin: '16px 0 0', color: EMAIL_COLORS.muted, fontSize: '12px', lineHeight: '19px' }
const primaryButton = { display: 'inline-block', minHeight: '44px', boxSizing: 'border-box' as const, padding: '13px 22px', borderRadius: '6px', backgroundColor: EMAIL_COLORS.ink, color: EMAIL_COLORS.white, fontSize: '14px', lineHeight: '18px', fontWeight: '700' as const, textDecoration: 'none' }
const secondaryButton = { ...primaryButton, backgroundColor: EMAIL_COLORS.paper, color: EMAIL_COLORS.ink, border: `1.5px solid ${EMAIL_COLORS.ink}` }
const badge = { display: 'inline-block', margin: '0 0 18px', padding: '7px 10px', borderRadius: '4px', backgroundColor: EMAIL_COLORS.white, borderLeft: `4px solid ${EMAIL_COLORS.clay}`, color: EMAIL_COLORS.ink, fontSize: '12px', lineHeight: '18px', fontWeight: '700' as const }
const detailsTable = { margin: '18px 0', borderCollapse: 'collapse' as const, border: `1px solid ${EMAIL_COLORS.border}` }
const detailLabel = { width: '38%', padding: '10px 12px', borderBottom: `1px solid ${EMAIL_COLORS.border}`, color: EMAIL_COLORS.muted, fontSize: '12px', lineHeight: '18px', verticalAlign: 'top' as const }
const detailValue = { padding: '10px 12px', borderBottom: `1px solid ${EMAIL_COLORS.border}`, color: EMAIL_COLORS.charcoal, fontSize: '13px', lineHeight: '19px', fontWeight: '600' as const, verticalAlign: 'top' as const }
const metricCell = { padding: '14px', border: `1px solid ${EMAIL_COLORS.border}`, backgroundColor: EMAIL_COLORS.white, verticalAlign: 'top' as const }
const metricLabel = { margin: '0 0 5px', color: EMAIL_COLORS.muted, fontSize: '11px', lineHeight: '16px', textTransform: 'uppercase' as const }
const metricValue = { margin: '0', color: EMAIL_COLORS.ink, fontSize: '21px', lineHeight: '27px', fontWeight: '700' as const }
const attachment = { display: 'inline-block', margin: '4px 8px 4px 0', padding: '9px 12px', border: `1px solid ${EMAIL_COLORS.border}`, borderRadius: '4px', backgroundColor: EMAIL_COLORS.white, color: EMAIL_COLORS.clay, fontSize: '12px', fontWeight: '700' as const, textDecoration: 'none' }
const otp = { margin: '18px 0', padding: '18px', border: `1px solid ${EMAIL_COLORS.border}`, borderLeft: `4px solid ${EMAIL_COLORS.clay}`, backgroundColor: EMAIL_COLORS.white, color: EMAIL_COLORS.ink, fontFamily: 'Courier New, monospace', fontSize: '32px', lineHeight: '38px', fontWeight: '700' as const, textAlign: 'center' as const, letterSpacing: '6px' }
const footer = { padding: '24px 32px', backgroundColor: EMAIL_COLORS.ink }
const footerBrand = { margin: '0 0 8px', color: EMAIL_COLORS.white, fontSize: '13px', lineHeight: '20px', fontWeight: '700' as const }
const footerText = { margin: '4px 0', color: EMAIL_COLORS.white, fontSize: '11px', lineHeight: '18px' }
const footerLink = { color: EMAIL_COLORS.white, textDecoration: 'underline' }