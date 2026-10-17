import React, { useState, useMemo } from "react";
import {
  Search, Plus, Pencil, Trash2, Phone, Mail, MapPin,
  RefreshCw, Download, Check, Copy, X, Loader2, Building, CreditCard
} from "lucide-react";
import {
  type AirlineContact,
  listAirlineContacts,
  createAirlineContact,
  updateAirlineContact,
  deleteAirlineContact,
} from "@/lib/airline-contacts.functions";
import { airlineIataCode, airlineLogoUrl } from "@/lib/airline-branding";

interface AirlineContactsTableProps {
  sheetSyncStatus?: "idle" | "syncing" | "success" | "error";
  onTriggerSheetSync?: () => Promise<void> | void;
}

export function AirlineContactDetailsTable({
  sheetSyncStatus: parentSyncStatus,
  onTriggerSheetSync,
}: AirlineContactsTableProps) {
  const [contacts, setContacts] = useState<AirlineContact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [editItem, setEditItem] = useState<AirlineContact | null>(null);
  const [deleteItem, setDeleteItem] = useState<AirlineContact | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Form state (all columns)
  const [formName, setFormName] = useState("");
  const [formPerson, setFormPerson] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formSupport, setFormSupport] = useState("");
  const [formTopupEmail, setFormTopupEmail] = useState("");
  const [formOtbEmail, setFormOtbEmail] = useState("");
  const [formBankName, setFormBankName] = useState("");
  const [formAccountTitle, setFormAccountTitle] = useState("");
  const [formIban, setFormIban] = useState("");
  const [formAddress, setFormAddress] = useState("");

  const resetForm = () => {
    setFormName("");
    setFormPerson("");
    setFormPhone("");
    setFormSupport("");
    setFormTopupEmail("");
    setFormOtbEmail("");
    setFormBankName("");
    setFormAccountTitle("");
    setFormIban("");
    setFormAddress("");
  };

  // Load contacts on mount
  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await listAirlineContacts();
        if (mounted && res && Array.isArray(res)) {
          setContacts(res);
        }
      } catch (err) {
        console.warn("[airline-contacts] Failed to load contacts (admin access required):", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Filtered contacts
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        (c.airline_name || "").toLowerCase().includes(q) ||
        (c.contact_person || "").toLowerCase().includes(q) ||
        (c.contact_number || "").toLowerCase().includes(q) ||
        (c.sales_support || "").toLowerCase().includes(q) ||
        (c.topup_email || "").toLowerCase().includes(q) ||
        (c.otb_email || "").toLowerCase().includes(q) ||
        (c.bank_name || "").toLowerCase().includes(q) ||
        (c.account_title || "").toLowerCase().includes(q) ||
        (c.iban || "").toLowerCase().includes(q) ||
        (c.address || "").toLowerCase().includes(q)
    );
  }, [contacts, search]);

  // Copy helper
  const handleCopy = (text: string | undefined, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Add contact handler
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const res = await createAirlineContact({
        data: {
          airline_name: formName.trim(),
          contact_person: formPerson.trim(),
          contact_number: formPhone.trim(),
          sales_support: formSupport.trim(),
          topup_email: formTopupEmail.trim(),
          otb_email: formOtbEmail.trim(),
          bank_name: formBankName.trim(),
          account_title: formAccountTitle.trim(),
          iban: formIban.trim(),
          address: formAddress.trim(),
          sort_order: (contacts.length + 1) * 10,
        },
      });
      if (res && res.contact) {
        setContacts((prev) => [...prev, res.contact]);
      } else {
        setContacts((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            airline_name: formName.trim(),
            contact_person: formPerson.trim(),
            contact_number: formPhone.trim(),
            sales_support: formSupport.trim(),
            topup_email: formTopupEmail.trim(),
            otb_email: formOtbEmail.trim(),
            bank_name: formBankName.trim(),
            account_title: formAccountTitle.trim(),
            iban: formIban.trim(),
            address: formAddress.trim(),
            sort_order: (contacts.length + 1) * 10,
            is_active: true,
          },
        ]);
      }
      resetForm();
      setAddModalOpen(false);
    } catch (err: any) {
      alert("Failed to save contact: " + (err?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  // Edit contact handler
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem || !formName.trim()) return;
    setSaving(true);
    try {
      const res = await updateAirlineContact({
        data: {
          id: editItem.id,
          airline_name: formName.trim(),
          contact_person: formPerson.trim(),
          contact_number: formPhone.trim(),
          sales_support: formSupport.trim(),
          topup_email: formTopupEmail.trim(),
          otb_email: formOtbEmail.trim(),
          bank_name: formBankName.trim(),
          account_title: formAccountTitle.trim(),
          iban: formIban.trim(),
          address: formAddress.trim(),
        },
      });
      if (res && res.contact) {
        setContacts((prev) =>
          prev.map((c) => (c.id === editItem.id ? res.contact : c))
        );
      } else {
        setContacts((prev) =>
          prev.map((c) =>
            c.id === editItem.id
              ? {
                  ...c,
                  airline_name: formName.trim(),
                  contact_person: formPerson.trim(),
                  contact_number: formPhone.trim(),
                  sales_support: formSupport.trim(),
                  topup_email: formTopupEmail.trim(),
                  otb_email: formOtbEmail.trim(),
                  bank_name: formBankName.trim(),
                  account_title: formAccountTitle.trim(),
                  iban: formIban.trim(),
                  address: formAddress.trim(),
                }
              : c
          )
        );
      }
      setEditItem(null);
      resetForm();
    } catch (err: any) {
      alert("Failed to update contact: " + (err?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  // Delete contact handler
  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;
    setSaving(true);
    try {
      await deleteAirlineContact({ data: { id: deleteItem.id } });
      setContacts((prev) => prev.filter((c) => c.id !== deleteItem.id));
      setDeleteItem(null);
    } catch (err: any) {
      alert("Failed to delete contact: " + (err?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  // Export to CSV including all 10 columns
  const handleExportCSV = () => {
    const headers = [
      "#",
      "Airline Name",
      "Contact Person",
      "Contact Number",
      "Sales Support",
      "Top UP Email",
      "OTB Email",
      "Bank Name",
      "Account Title",
      "IBAN",
      "Address",
    ];
    const rows = filtered.map((c, i) => [
      i + 1,
      `"${(c.airline_name || "").replace(/"/g, '""')}"`,
      `"${(c.contact_person || "").replace(/"/g, '""')}"`,
      `"${(c.contact_number || "").replace(/"/g, '""')}"`,
      `"${(c.sales_support || "").replace(/"/g, '""')}"`,
      `"${(c.topup_email || "").replace(/"/g, '""')}"`,
      `"${(c.otb_email || "").replace(/"/g, '""')}"`,
      `"${(c.bank_name || "").replace(/"/g, '""')}"`,
      `"${(c.account_title || "").replace(/"/g, '""')}"`,
      `"${(c.iban || "").replace(/"/g, '""')}"`,
      `"${(c.address || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Airline-Contact-Details-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={containerStyle}>
      {/* Header bar */}
      <div style={topBarStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={searchContainerStyle}>
            <Search size={15} style={{ color: "#78716C" }} />
            <input
              type="text"
              placeholder="Search airline, person, phone, email, bank, IBAN, address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={searchInputStyle}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#78716C", padding: 2 }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <span style={countBadgeStyle}>
            {filtered.length} {filtered.length === 1 ? "Airline" : "Airlines"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>

          <button
            type="button"
            onClick={handleExportCSV}
            style={ghostBtnStyle}
            title="Export contact directory to CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setAddModalOpen(true);
            }}
            style={primaryBtnStyle}
          >
            <Plus size={15} />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Sync alert banner */}
      {syncMessage && (
        <div style={syncAlertStyle}>
          <span>{syncMessage}</span>
          <button
            type="button"
            onClick={() => setSyncMessage(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#141413", marginLeft: "auto" }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Pure Table Without Scrollbar */}
      <div style={tableContainerStyle}>
        <table style={tableStyle}>
          <thead>
            <tr style={theadRowStyle}>
              <th style={{ ...thStyle, width: 32, textAlign: "center" }}>#</th>
              <th style={{ ...thStyle, minWidth: 150 }}>AIRLINE</th>
              <th style={{ ...thStyle, minWidth: 130 }}>CONTACT PERSON</th>
              <th style={{ ...thStyle, minWidth: 140 }}>CONTACT NUMBER</th>
              <th style={{ ...thStyle, minWidth: 160 }}>SALES SUPPORT</th>
              <th style={{ ...thStyle, minWidth: 140 }}>TOP UP EMAIL</th>
              <th style={{ ...thStyle, minWidth: 140 }}>OTB EMAIL</th>
              <th style={{ ...thStyle, minWidth: 170 }}>BANK & ACCOUNT</th>
              <th style={{ ...thStyle, minWidth: 160 }}>IBAN</th>
              <th style={{ ...thStyle, minWidth: 160 }}>ADDRESS</th>
              <th style={{ ...thStyle, width: 70, textAlign: "center" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} style={emptyTdStyle}>
                  {loading ? "Loading airline contacts..." : "No matching airline contacts found."}
                </td>
              </tr>
            ) : (
              filtered.map((item, idx) => {
                const iata = airlineIataCode(item.airline_name);
                const logo = airlineLogoUrl(item.airline_name);
                return (
                  <tr
                    key={item.id}
                    style={{
                      ...trStyle,
                      backgroundColor: idx % 2 === 0 ? "#FAF9F5" : "#FFFFFF",
                    }}
                  >
                    {/* Index */}
                    <td style={{ ...tdStyle, textAlign: "center", color: "#78716C", fontSize: 11 }}>
                      {idx + 1}
                    </td>

                    {/* Airline Name + Logo */}
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {logo ? (
                          <div style={logoBadgeStyle}>
                            <img
                              src={logo}
                              alt={item.airline_name}
                              style={{ width: "100%", height: "100%", objectFit: "contain" }}
                              onError={(e) => {
                                (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                              }}
                            />
                          </div>
                        ) : null}
                        <div>
                          <div style={{ fontWeight: 700, color: "#1C1917", fontSize: 12.5 }}>
                            {item.airline_name}
                          </div>
                          {iata ? (
                            <span style={iataBadgeStyle}>IATA: {iata}</span>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    {/* Airline Contact Person & Number */}
                    <td style={tdStyle}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {item.contact_person ? <span style={{ fontWeight: 600, color: "#1C1917", fontSize: 12 }}>{item.contact_person}</span> : null}
                        {item.contact_number ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Phone size={13} style={{ color: "#D97757", flexShrink: 0 }} />
                            <span style={phoneTextStyle}>{item.contact_number}</span>
                            <button type="button" onClick={() => handleCopy(item.contact_number, `p-${item.id}`)} style={copyBtnStyle} title="Copy phone">
                              {copiedId === `p-${item.id}` ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                            </button>
                          </div>
                        ) : null}
                        {!item.contact_person && !item.contact_number ? <span style={emptyFieldStyle}>—</span> : null}
                      </div>
                    </td>

                    {/* Sales Support */}
                    <td style={tdStyle}>
                      {item.sales_support ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Mail size={13} style={{ color: "#D97757", flexShrink: 0 }} />
                          <span style={supportTextStyle}>{item.sales_support}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.sales_support, `s-${item.id}`)}
                            style={copyBtnStyle}
                            title="Copy sales support email"
                          >
                            {copiedId === `s-${item.id}` ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                          </button>
                        </div>
                      ) : (
                        <span style={emptyFieldStyle}>—</span>
                      )}
                    </td>

                    {/* Top UP Email */}
                    <td style={tdStyle}>
                      {item.topup_email ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Mail size={13} style={{ color: "#D97757", flexShrink: 0 }} />
                          <span style={supportTextStyle}>{item.topup_email}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.topup_email, `t-${item.id}`)}
                            style={copyBtnStyle}
                            title="Copy top up email"
                          >
                            {copiedId === `t-${item.id}` ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                          </button>
                        </div>
                      ) : (
                        <span style={emptyFieldStyle}>—</span>
                      )}
                    </td>

                    {/* OTB Email */}
                    <td style={tdStyle}>
                      {item.otb_email ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Mail size={13} style={{ color: "#D97757", flexShrink: 0 }} />
                          <span style={supportTextStyle}>{item.otb_email}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.otb_email, `o-${item.id}`)}
                            style={copyBtnStyle}
                            title="Copy OTB email"
                          >
                            {copiedId === `o-${item.id}` ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                          </button>
                        </div>
                      ) : (
                        <span style={emptyFieldStyle}>—</span>
                      )}
                    </td>

                    {/* Bank Name */}
                    <td style={tdStyle}>
                      {item.bank_name ? <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Building size={12} style={{ color: "#D97757", flexShrink: 0 }} /><span style={{ fontWeight: 600, color: "#1C1917", fontSize: 11.5 }}>{item.bank_name}</span></div> : <span style={emptyFieldStyle}>—</span>}
                    </td>
                    {/* Account Title */}
                    <td style={tdStyle}>
                      {item.account_title ? <span style={{ color: "#1C1917", fontSize: 11.5, fontWeight: 600 }}>{item.account_title}</span> : <span style={emptyFieldStyle}>—</span>}
                    </td>

                    {/* IBAN */}
                    <td style={tdStyle}>
                      {item.iban ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <CreditCard size={12} style={{ color: "#78716C", flexShrink: 0 }} />
                          <span style={ibanTextStyle}>{item.iban}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.iban, `ib-${item.id}`)}
                            style={copyBtnStyle}
                            title="Copy IBAN"
                          >
                            {copiedId === `ib-${item.id}` ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                          </button>
                        </div>
                      ) : (
                        <span style={emptyFieldStyle}>—</span>
                      )}
                    </td>

                    {/* Address */}
                    <td style={tdStyle}>
                      {item.address ? (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                          <MapPin size={13} style={{ color: "#78716C", marginTop: 2, flexShrink: 0 }} />
                          <span style={addressTextStyle}>{item.address}</span>
                        </div>
                      ) : (
                        <span style={emptyFieldStyle}>—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditItem(item);
                            setFormName(item.airline_name);
                            setFormPerson(item.contact_person || "");
                            setFormPhone(item.contact_number || "");
                            setFormSupport(item.sales_support || "");
                            setFormTopupEmail(item.topup_email || "");
                            setFormOtbEmail(item.otb_email || "");
                            setFormBankName(item.bank_name || "");
                            setFormAccountTitle(item.account_title || "");
                            setFormIban(item.iban || "");
                            setFormAddress(item.address || "");
                          }}
                          style={actionBtnStyle}
                          title="Edit airline contact"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteItem(item)}
                          style={{ ...actionBtnStyle, color: "#dc2626" }}
                          title="Delete contact"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {addModalOpen && (
        <div style={overlayStyle} onClick={() => setAddModalOpen(false)}>
          <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h3 style={modalTitleStyle}>Add Airline Contact Details</h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                style={closeBtnStyle}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} style={formStyle}>
              <div style={formGridStyle}>
                {/* Column 1 */}
                <div style={formColStyle}>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Airline Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Flydubai"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      style={inputStyle}
                      autoFocus
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Contact Person</label>
                    <input
                      type="text"
                      placeholder="e.g. Mr. Mansoor Ali (Account Mgr)"
                      value={formPerson}
                      onChange={(e) => setFormPerson(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Airline Contact Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 021-111-786-786"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Sales Support (Email / Helpdesk)</label>
                    <input
                      type="text"
                      placeholder="e.g. salessupport@airline.com"
                      value={formSupport}
                      onChange={(e) => setFormSupport(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Top UP Email</label>
                    <input
                      type="text"
                      placeholder="e.g. topup.khi@airline.com"
                      value={formTopupEmail}
                      onChange={(e) => setFormTopupEmail(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Column 2 */}
                <div style={formColStyle}>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>OTB (Ok To Board) Email</label>
                    <input
                      type="text"
                      placeholder="e.g. otb.desk@airline.com"
                      value={formOtbEmail}
                      onChange={(e) => setFormOtbEmail(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Meezan Bank / HBL"
                      value={formBankName}
                      onChange={(e) => setFormBankName(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Account Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Airline Pakistan Ltd"
                      value={formAccountTitle}
                      onChange={(e) => setFormAccountTitle(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>IBAN</label>
                    <input
                      type="text"
                      placeholder="e.g. PK00MEZN0000000000000000"
                      value={formIban}
                      onChange={(e) => setFormIban(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Branch Address / Location</label>
                    <textarea
                      placeholder="e.g. Office # 12, Ground Floor, Karachi"
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      rows={2}
                      style={textareaStyle}
                    />
                  </div>
                </div>
              </div>

              <div style={modalFooterStyle}>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  style={ghostBtnStyle}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={primaryBtnStyle}
                  disabled={saving}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{saving ? "Saving..." : "Save & Sync Sheet"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div style={overlayStyle} onClick={() => setEditItem(null)}>
          <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h3 style={modalTitleStyle}>Edit Airline Contact Details</h3>
              <button
                type="button"
                onClick={() => setEditItem(null)}
                style={closeBtnStyle}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={formStyle}>
              <div style={formGridStyle}>
                {/* Column 1 */}
                <div style={formColStyle}>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Airline Name *</label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      style={inputStyle}
                      autoFocus
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Contact Person</label>
                    <input
                      type="text"
                      placeholder="e.g. Mr. Mansoor Ali"
                      value={formPerson}
                      onChange={(e) => setFormPerson(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Airline Contact Number</label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Sales Support (Email / Helpdesk)</label>
                    <input
                      type="text"
                      value={formSupport}
                      onChange={(e) => setFormSupport(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Top UP Email</label>
                    <input
                      type="text"
                      value={formTopupEmail}
                      onChange={(e) => setFormTopupEmail(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Column 2 */}
                <div style={formColStyle}>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>OTB (Ok To Board) Email</label>
                    <input
                      type="text"
                      value={formOtbEmail}
                      onChange={(e) => setFormOtbEmail(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Bank Name</label>
                    <input
                      type="text"
                      value={formBankName}
                      onChange={(e) => setFormBankName(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Account Title</label>
                    <input
                      type="text"
                      value={formAccountTitle}
                      onChange={(e) => setFormAccountTitle(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>IBAN</label>
                    <input
                      type="text"
                      value={formIban}
                      onChange={(e) => setFormIban(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Branch Address / Location</label>
                    <textarea
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      rows={2}
                      style={textareaStyle}
                    />
                  </div>
                </div>
              </div>

              <div style={modalFooterStyle}>
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  style={ghostBtnStyle}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={primaryBtnStyle}
                  disabled={saving}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{saving ? "Updating..." : "Update & Sync"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteItem && (
        <div style={overlayStyle} onClick={() => setDeleteItem(null)}>
          <div style={{ ...modalBoxStyle, maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h3 style={modalTitleStyle}>Delete Contact</h3>
              <button
                type="button"
                onClick={() => setDeleteItem(null)}
                style={closeBtnStyle}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: "16px 20px", color: "#1C1917", fontSize: 13, lineHeight: 1.6 }}>
              Are you sure you want to remove <strong>{deleteItem.airline_name}</strong> from the airline directory?
              <div style={{ marginTop: 8, fontSize: 12, color: "#78716C" }}>
                This record will be removed from the database and the Google Sheets tab 'Airline Contact Details' will be immediately updated.
              </div>
            </div>
            <div style={modalFooterStyle}>
              <button
                type="button"
                onClick={() => setDeleteItem(null)}
                style={ghostBtnStyle}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                style={{ ...primaryBtnStyle, backgroundColor: "#dc2626" }}
                disabled={saving}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{saving ? "Deleting..." : "Delete Permanently"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Styles in Rohi Warm Clay ---------- */

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  width: "100%",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 12,
  padding: "10px 16px",
  backgroundColor: "#FAF9F5",
  borderRadius: 8,
  border: "1px solid #E7E5E4",
};

const searchContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  backgroundColor: "#FFFFFF",
  border: "1px solid #E7E5E4",
  borderRadius: 6,
  padding: "6px 10px",
  minWidth: 260,
  maxWidth: 380,
};

const searchInputStyle: React.CSSProperties = {
  border: "none",
  outline: "none",
  fontSize: 12,
  color: "#1C1917",
  width: "100%",
  backgroundColor: "transparent",
};

const countBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#78716C",
  backgroundColor: "#F4EFEA",
  padding: "4px 8px",
  borderRadius: 4,
};

const syncBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 12px",
  backgroundColor: "#FAF9F5",
  border: "1px solid #D97757",
  color: "#D97757",
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 6,
  cursor: "pointer",
  transition: "all 0.15s ease",
};

const primaryBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  backgroundColor: "#141413",
  border: "none",
  color: "#FAF9F5",
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 6,
  cursor: "pointer",
  boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
};

const ghostBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 12px",
  backgroundColor: "#FFFFFF",
  border: "1px solid #E7E5E4",
  color: "#1C1917",
  fontSize: 12,
  fontWeight: 500,
  borderRadius: 6,
  cursor: "pointer",
};

const syncAlertStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "8px 12px",
  backgroundColor: "#F4EFEA",
  border: "1px solid #D97757",
  borderRadius: 6,
  fontSize: 12,
  color: "#141413",
  fontWeight: 500,
};

const tableContainerStyle: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  borderRadius: 8,
  border: "1px solid #E7E5E4",
  overflow: "visible",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  width: "100%",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};

const theadRowStyle: React.CSSProperties = {
  backgroundColor: "#173B63",
};

const thStyle: React.CSSProperties = {
  padding: "12px 9px",
  color: "#FFFFFF",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.045em",
  textAlign: "left",
  borderBottom: "2px solid #D99B32",
  whiteSpace: "nowrap",
  textShadow: "0 1px 1px rgba(0,0,0,0.18)",
};

const trStyle: React.CSSProperties = {
  borderBottom: "1px solid #E7E5E4",
  transition: "background-color 0.15s ease",
};

const tdStyle: React.CSSProperties = {
  padding: "9px 8px",
  verticalAlign: "middle",
  color: "#1C1917",
  lineHeight: 1.4,
  wordBreak: "break-word",
};

const emptyTdStyle: React.CSSProperties = {
  padding: "40px 16px",
  textAlign: "center",
  color: "#78716C",
  fontStyle: "italic",
  fontSize: 13,
};

const logoBadgeStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 4,
  backgroundColor: "#FAF9F5",
  border: "1px solid #E7E5E4",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 2,
  flexShrink: 0,
};

const iataBadgeStyle: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  color: "#D97757",
  backgroundColor: "#F4EFEA",
  padding: "1px 5px",
  borderRadius: 3,
  display: "inline-block",
  marginTop: 2,
};

const phoneTextStyle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 600,
  color: "#1C1917",
};

const supportTextStyle: React.CSSProperties = {
  fontSize: 11.5,
  color: "#1C1917",
  whiteSpace: "pre-wrap",
};

const ibanTextStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "monospace",
  color: "#1C1917",
  fontWeight: 600,
};

const addressTextStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#44403C",
  whiteSpace: "pre-wrap",
};

const emptyFieldStyle: React.CSSProperties = {
  color: "#A8A29E",
  fontSize: 12,
};

const copyBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#78716C",
  padding: 2,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 3,
  flexShrink: 0,
};

const actionBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#78716C",
  padding: 4,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 4,
  transition: "all 0.15s ease",
};

/* ---------- Modals ---------- */

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(20, 20, 19, 0.5)",
  backdropFilter: "blur(2px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 16,
};

const modalBoxStyle: React.CSSProperties = {
  backgroundColor: "#FAF9F5",
  borderRadius: 10,
  width: "100%",
  maxWidth: 680,
  maxHeight: "90vh",
  overflowY: "auto",
  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
  border: "1px solid #E7E5E4",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 20px",
  borderBottom: "1px solid #E7E5E4",
  backgroundColor: "#F4EFEA",
};

const modalTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 700,
  color: "#141413",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#78716C",
  padding: 4,
};

const formStyle: React.CSSProperties = {
  padding: "16px 20px",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
};

const formColStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const formGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 600,
  color: "#1C1917",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #E7E5E4",
  fontSize: 12,
  color: "#1C1917",
  backgroundColor: "#FFFFFF",
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #E7E5E4",
  fontSize: 12,
  color: "#1C1917",
  backgroundColor: "#FFFFFF",
  outline: "none",
  resize: "vertical",
};

const modalFooterStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 8,
  paddingTop: 12,
  borderTop: "1px solid #E7E5E4",
  marginTop: 6,
};
