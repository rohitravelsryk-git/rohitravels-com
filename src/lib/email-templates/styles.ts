export const BRAND_NAVY = "#0b2545";
export const BRAND_GOLD = "#e8b647";
export const BRAND_CREAM = "#f8f4ee";
export const BRAND_WHITE = "#ffffff";
export const FONT_SERIF = "Georgia, 'Times New Roman', serif";
export const FONT_SANS = "Arial, Helvetica, sans-serif";

export const brandStyles = {
  container: {
    padding: '32px 28px',
    maxWidth: '560px',
    backgroundColor: BRAND_WHITE,
    border: '1px solid #e6e1d6',
    borderTop: `5px solid ${BRAND_GOLD}`,
    borderRadius: '12px',
    margin: '0 auto'
  },
  h1: {
    fontSize: '24px',
    fontWeight: 'bold' as const,
    color: BRAND_NAVY,
    margin: '0 0 8px',
    fontFamily: FONT_SERIF,
    letterSpacing: '-0.2px'
  },
  text: {
    fontSize: '15px',
    color: '#3f4657',
    lineHeight: '1.6',
    margin: '0 0 22px',
    fontFamily: FONT_SANS
  },
  button: {
    backgroundColor: BRAND_GOLD,
    color: BRAND_NAVY,
    fontSize: '14px',
    fontWeight: 'bold' as const,
    letterSpacing: '0.6px',
    textTransform: 'uppercase' as const,
    borderRadius: '999px',
    padding: '14px 26px',
    textDecoration: 'none',
    fontFamily: FONT_SANS
  },
  footer: {
    fontSize: '12px',
    color: '#8a8f9c',
    margin: '30px 0 0',
    borderTop: '1px solid #eeeae0',
    paddingTop: '16px',
    fontFamily: FONT_SANS
  }
};
