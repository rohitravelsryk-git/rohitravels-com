import type { ComponentType } from 'react'
import { TRANSACTIONAL_COMPONENTS, TRANSACTIONAL_DEFINITIONS } from './branded-transactional'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  ...Object.fromEntries(Object.entries(TRANSACTIONAL_DEFINITIONS).map(([name, definition]) => [name, {
    component: TRANSACTIONAL_COMPONENTS[name as keyof typeof TRANSACTIONAL_COMPONENTS],
    subject: definition.title,
    displayName: definition.title,
    previewData: {
      recipientName: 'Travel Partner',
      status: name.includes('failed') ? 'ACTION REQUIRED' : 'CONFIRMED',
      details: [['Reference', 'RIT-2026-09123'], ['Status', 'Ready for review'], ['Date', '23 September 2026']],
      metrics: name === 'daily_financial_digest' ? [['Gross volume', 'PKR 1,250,000'], ['Net markup', 'PKR 82,500'], ['Tickets issued', '34'], ['Pending settlement', 'PKR 175,000']] : undefined,
      actionUrl: 'https://www.rohitravels.com',
      secondaryUrl: 'https://www.rohitravels.com',
      attachmentUrl: 'https://www.rohitravels.com',
      otp: name === 'two_factor_code' ? '123456' : undefined,
      remarks: 'This preview uses sample information only.',
    },
  }])),
}
