export interface SaleDetails {
  country?: string;
  agent?: string;
  pax_name?: string;
  contact_no?: string;
  vendor?: string;
}

export interface SaleRowInput extends SaleDetails {
  date: string;
  sale_amount: string | number;
  purchase_amount: string | number;
}

const SALE_DETAILS_TAG = "[[SALE_META:";

export function formatSaleDescription(details: SaleDetails, fallbackSummary?: string): string {
  const parts: string[] = [];
  const meta: Record<string, string> = {};

  if (details.pax_name?.trim()) {
    parts.push(details.pax_name.trim());
    meta.pax = details.pax_name.trim();
  }
  if (details.country?.trim()) {
    parts.push(details.country.trim());
    meta.country = details.country.trim();
  }
  if (details.agent?.trim()) {
    parts.push(`Agent: ${details.agent.trim()}`);
    meta.agent = details.agent.trim();
  }
  if (details.contact_no?.trim()) {
    parts.push(`Tel: ${details.contact_no.trim()}`);
    meta.contact = details.contact_no.trim();
  }
  if (details.vendor?.trim()) {
    parts.push(`Vendor: ${details.vendor.trim()}`);
    meta.vendor = details.vendor.trim();
  }

  const userVisible = parts.length > 0 ? parts.join(" • ") : (fallbackSummary?.trim() || "Sale Booking");
  const metaJson = JSON.stringify(meta);
  return `${userVisible} ${SALE_DETAILS_TAG}${metaJson}]]`;
}

export function parseSaleDetails(description?: string | null, party?: string | null): SaleDetails {
  const rawDesc = String(description ?? "").trim();
  const rawParty = String(party ?? "").trim();
  const res: SaleDetails = {
    country: "",
    agent: rawParty,
    pax_name: "",
    contact_no: "",
    vendor: "",
  };

  const tagIdx = rawDesc.indexOf(SALE_DETAILS_TAG);
  if (tagIdx !== -1) {
    const endIdx = rawDesc.indexOf("]]", tagIdx);
    if (endIdx !== -1) {
      const jsonStr = rawDesc.substring(tagIdx + SALE_DETAILS_TAG.length, endIdx);
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.country) res.country = parsed.country;
        if (parsed.agent) res.agent = parsed.agent;
        if (parsed.pax) res.pax_name = parsed.pax;
        if (parsed.contact) res.contact_no = parsed.contact;
        if (parsed.vendor) res.vendor = parsed.vendor;
        return res;
      } catch {
        // Fall back to pattern matching
      }
    }
  }

  const clean = tagIdx !== -1 ? rawDesc.substring(0, tagIdx).trim() : rawDesc;

  const agentMatch = clean.match(/(?:Agent|Customer):\s*([^•\n,]+)/i);
  if (agentMatch) res.agent = agentMatch[1].trim();

  const vendorMatch = clean.match(/Vendor:\s*([^•\n,]+)/i);
  if (vendorMatch) res.vendor = vendorMatch[1].trim();

  const telMatch = clean.match(/(?:Tel|Contact|Phone|Cell):\s*([^•\n,]+)/i);
  if (telMatch) res.contact_no = telMatch[1].trim();

  const countryMatch = clean.match(/Country:\s*([^•\n,]+)/i);
  if (countryMatch) res.country = countryMatch[1].trim();

  const paxMatch = clean.match(/(?:Pax|Passenger):\s*([^•\n,]+)/i);
  if (paxMatch) {
    res.pax_name = paxMatch[1].trim();
  } else if (!res.agent && !res.vendor && clean) {
    res.pax_name = clean;
  }

  if (!res.agent && rawParty) {
    res.agent = rawParty;
  }

  return res;
}

export function cleanSaleDescriptionDisplay(description?: string | null): string {
  const raw = String(description ?? "").trim();
  const tagIdx = raw.indexOf(SALE_DETAILS_TAG);
  if (tagIdx !== -1) {
    return raw.substring(0, tagIdx).trim();
  }
  return raw;
}
