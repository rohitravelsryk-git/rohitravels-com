import React, { useState, useMemo } from "react";
import {
  Search, Plus, Pencil, Trash2, Phone, Mail, MapPin,
  RefreshCw, Download, Check, Copy, X, Loader2, FileSpreadsheet
} from "lucide-react";
import {
  type AirlineContact,
  DEFAULT_AIRLINE_CONTACTS,
  listAirlineContacts,
  createAirlineContact,
  updateAirlineContact,
  deleteAirlineContact,
  syncAirlineContactsLive,
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
  const [contacts, setContacts] = useState<AirlineContact[]>(DEFAULT_AIRLINE_CONTACTS);
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

  // Form state
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formSupport, setFormSupport] = useState("");
  const [formAddress, setFormAddress] = useState("");

  // Load contacts on mount
  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await listAirlineContacts();
        if (mounted && res && res.length > 0) {
          setContacts(res);
        }
      } catch (err) {
        console.warn("[airline-contacts] Falling back to default list:", err);
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
        c.airline_name.toLowerCase().includes(q) ||
        c.contact_number.toLowerCase().includes(q) ||
        c.sales_support.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Sync with Google Sheet handler
  const handleLiveSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      if (onTriggerSheetSync) {
        await onTriggerSheetSync();
      } else {
        const res = await syncAirlineContactsLive();
        if (res.status === "success") {
          setSyncMessage("Live Synced with Google Sheet!");
        } else {
          setSyncMessage(res.error || "Sync completed with warnings");
        }
      }
    } catch (err: any) {
      setSyncMessage(err?.message || "Sync failed");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
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
          contact_number: formPhone.trim(),
          sales_support: formSupport.trim(),
          address: formAddress.trim(),
          sort_order: (contacts.length + 1) * 10,
        },
      });
      if (res?.contact) {
        setContacts((prev) => [...prev, res.contact]);
      } else {
        // Optimistic fallback
        const newContact: AirlineContact = {
          id: `contact-temp-${Date.now()}`,
          airline_name: formName.trim(),
          contact_number: formPhone.trim(),
          sales_support: formSupport.trim(),
          address: formAddress.trim(),
          sort_order: (contacts.length + 1) * 10,
          is_active: true,
        };
        setContacts((prev) => [...prev, newContact]);
      }
      setAddModalOpen(false);
      setFormName("");
      setFormPhone("");
      setFormSupport("");
      setFormAddress("");
    } catch (err: any) {
      alert("Failed to add contact: " + (err?.message || String(err)));
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
      await updateAirlineContact({
        data: {
          id: editItem.id,
          airline_name: formName.trim(),
          contact_number: formPhone.trim(),
          sales_support: formSupport.trim(),
          address: formAddress.trim(),
        },
      });
      setContacts((prev) =>
        prev.map((c) =>
          c.id === editItem.id
            ? {
                ...c,
                airline_name: formName.trim(),
                contact_number: formPhone.trim(),
                sales_support: formSupport.trim(),
                address: formAddress.trim(),
              }
            : c
        )
      );
      setEditItem(null);
    } catch (err: any) {
      alert("Failed to update contact: " + (err?.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  // Delete contact handler
  const handleDeleteSubmit = async () => {
    if (!deleteItem) return;
    setSaving(true);
    try {
      await deleteAirlineContact({
        data: { id: deleteItem.id },
      });
      setContacts((prev) => prev.filter((c) => c.id !== deleteItem.id));
      setDeleteItem(null);
    } catch (err: any) {
      alert("Failed to delete contact: " + (err?.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  // CSV export handler
  const handleExportCSV = () => {
    const headers = ["#", "Airline Name", "Contact Number", "Sales Support", "Address"];
    const rows = filtered.map((c, i) => [
      i + 1,
      `"${(c.airline_name || "").replace(/"/g, '""')}"`,
      `"${(c.contact_number || "").replace(/"/g, '""')}"`,
      `"${(c.sales_support || "").replace(/"/g, '""')}"`,
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
      {/* Top Banner (Rohi Terracotta) */}
      <div style={bannerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>✈</span>
          <div>
            <h2 style={bannerTitleStyle}>ROHI INTERNATIONAL TRAVELS | AIRLINE CONTACT DETAILS</h2>
            <p style={bannerSubtitleStyle}>
              Official sales support numbers, reservation hotlines & branch directory • Live Google Sheets Sync
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleLiveSync}
            disabled={syncing}
            style={syncBtnStyle}
            title="Sync with Google Sheet 'Airline Contact Details'"
          >
            {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            <span>{syncing ? "Syncing..." : "Sync Sheet"}</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            style={ghostBtnStyle}
            title="Export contact directory to CSV"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFormName("");
              setFormPhone("");
              setFormSupport("");
              setFormAddress("");
              setAddModalOpen(true);
            }}
            style={primaryBtnStyle}
          >
            <Plus size={16} />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Sync alert banner if present */}
      {syncMessage && (
        <div style={syncAlertStyle}>
          <Check size={16} />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Stats and Search Bar */}
      <div style={statsBarStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={statChipStyle}>
            <span style={statNumStyle}>{filtered.length}</span>
            <span style={statLabelStyle}>Airlines Listed</span>
          </div>
          <div style={statChipStyle}>
            <span style={statNumStyle}>{contacts.filter((c) => !!c.contact_number).length}</span>
            <span style={statLabelStyle}>Direct Phone Lines</span>
          </div>
          <div style={statChipStyle}>
            <span style={statNumStyle}>{contacts.filter((c) => !!c.sales_support).length}</span>
            <span style={statLabelStyle}>Sales Emails</span>
          </div>
        </div>

        {/* Search input */}
        <div style={searchWrapStyle}>
          <Search size={16} style={{ color: "#78716C" }} />
          <input
            type="text"
            placeholder="Search airline, phone, email, or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchInputStyle}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#78716C" }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Pure Table Without Scrollbar */}
      <div style={tableContainerStyle}>
        <table style={tableStyle}>
          <thead>
            <tr style={theadRowStyle}>
              <th style={{ ...thStyle, width: 50, textAlign: "center" }}>#</th>
              <th style={{ ...thStyle, minWidth: 200 }}>AIRLINE NAME</th>
              <th style={{ ...thStyle, minWidth: 220 }}>AIRLINE CONTACT NUMBER</th>
              <th style={{ ...thStyle, minWidth: 260 }}>SALES SUPPORT</th>
              <th style={{ ...thStyle, minWidth: 260 }}>ADDRESS</th>
              <th style={{ ...thStyle, width: 100, textAlign: "center" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={emptyTdStyle}>
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
                    <td style={{ ...tdStyle, textAlign: "center", color: "#78716C", fontSize: 12 }}>
                      {idx + 1}
                    </td>

                    {/* Airline Name + Logo */}
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                          <div style={{ fontWeight: 700, color: "#1C1917", fontSize: 13.5 }}>
                            {item.airline_name}
                          </div>
                          {iata ? (
                            <span style={iataBadgeStyle}>IATA: {iata}</span>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    {/* Contact Number */}
                    <td style={tdStyle}>
                      {item.contact_number ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Phone size={14} style={{ color: "#D97757", flexShrink: 0 }} />
                          <span style={phoneTextStyle}>{item.contact_number}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.contact_number, `p-${item.id}`)}
                            style={copyBtnStyle}
                            title="Copy phone number"
                          >
                            {copiedId === `p-${item.id}` ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                          </button>
                        </div>
                      ) : (
                        <span style={emptyFieldStyle}>—</span>
                      )}
                    </td>

                    {/* Sales Support */}
                    <td style={tdStyle}>
                      {item.sales_support ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Mail size={14} style={{ color: "#D97757", flexShrink: 0 }} />
                          <span style={supportTextStyle}>{item.sales_support}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.sales_support, `s-${item.id}`)}
                            style={copyBtnStyle}
                            title="Copy email / sales support"
                          >
                            {copiedId === `s-${item.id}` ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                          </button>
                        </div>
                      ) : (
                        <span style={emptyFieldStyle}>—</span>
                      )}
                    </td>

                    {/* Address */}
                    <td style={tdStyle}>
                      {item.address ? (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <MapPin size={14} style={{ color: "#78716C", marginTop: 2, flexShrink: 0 }} />
                          <span style={addressTextStyle}>{item.address}</span>
                        </div>
                      ) : (
                        <span style={emptyFieldStyle}>—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditItem(item);
                            setFormName(item.airline_name);
                            setFormPhone(item.contact_number || "");
                            setFormSupport(item.sales_support || "");
                            setFormAddress(item.address || "");
                          }}
                          style={actionIconBtnStyle}
                          title="Edit airline contact"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteItem(item)}
                          style={{ ...actionIconBtnStyle, color: "#dc2626" }}
                          title="Delete airline contact"
                        >
                          <Trash2 size={14} />
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
              <h3 style={modalTitleStyle}>Add Airline Contact</h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                style={closeBtnStyle}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} style={formStyle}>
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
                <label style={labelStyle}>Contact Number</label>
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
                  placeholder="e.g. sales@airline.com"
                  value={formSupport}
                  onChange={(e) => setFormSupport(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Branch Address / Location</label>
                <textarea
                  placeholder="e.g. Office # 12, Ground Floor, Trade Center, Karachi"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  rows={3}
                  style={textareaStyle}
                />
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
              <h3 style={modalTitleStyle}>Edit Airline Contact</h3>
              <button
                type="button"
                onClick={() => setEditItem(null)}
                style={closeBtnStyle}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={formStyle}>
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
                <label style={labelStyle}>Contact Number</label>
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
                <label style={labelStyle}>Branch Address / Location</label>
                <textarea
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  rows={3}
                  style={textareaStyle}
                />
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
          <div style={{ ...modalBoxStyle, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
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
            <div style={{ padding: "16px 20px" }}>
              <p style={{ margin: "0 0 16px 0", fontSize: 14, color: "#1C1917" }}>
                Are you sure you want to remove the contact details for{" "}
                <strong>{deleteItem.airline_name}</strong>?
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#78716C" }}>
                This record will be removed from the database and the Google Sheets tab 'Airline Contact Details' will be immediately updated.
              </p>
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
                onClick={handleDeleteSubmit}
                style={{ ...primaryBtnStyle, backgroundColor: "#dc2626", borderColor: "#dc2626" }}
                disabled={saving}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{saving ? "Deleting..." : "Confirm Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Styles following Rohi Warm Clay Design System
const containerStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const bannerStyle: React.CSSProperties = {
  backgroundColor: "#D97757",
  color: "#FFFFFF",
  borderRadius: 10,
  padding: "16px 22px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 14,
  boxShadow: "0 2px 8px rgba(217, 119, 87, 0.2)",
};

const bannerTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: "0.02em",
};

const bannerSubtitleStyle: React.CSSProperties = {
  margin: "4px 0 0 0",
  fontSize: 12.5,
  opacity: 0.92,
};

const syncAlertStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  backgroundColor: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
  padding: "10px 16px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
};

const statsBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 12,
  padding: "4px 0",
};

const statChipStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  backgroundColor: "#FAF9F5",
  border: "1px solid #E7E5E4",
  padding: "6px 14px",
  borderRadius: 8,
};

const statNumStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: "#D97757",
  fontVariantNumeric: "tabular-nums",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#78716C",
  fontWeight: 600,
};

const searchWrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  backgroundColor: "#FAF9F5",
  border: "1px solid #E7E5E4",
  borderRadius: 8,
  padding: "8px 12px",
  minWidth: 280,
};

const searchInputStyle: React.CSSProperties = {
  border: "none",
  outline: "none",
  backgroundColor: "transparent",
  fontSize: 13,
  color: "#1C1917",
  width: "100%",
};

// Pure Table Container without Scrollbars!
const tableContainerStyle: React.CSSProperties = {
  width: "100%",
  backgroundColor: "#FFFFFF",
  border: "1px solid #E7E5E4",
  borderRadius: 10,
  overflow: "visible", // NO inner scrollbar!
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
  tableLayout: "auto",
};

const theadRowStyle: React.CSSProperties = {
  backgroundColor: "#141413", // Matte Black header
};

const thStyle: React.CSSProperties = {
  padding: "12px 14px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: "#FAF9F5", // Cream text
  letterSpacing: "0.05em",
  borderBottom: "1px solid #141413",
  whiteSpace: "nowrap",
};

const trStyle: React.CSSProperties = {
  borderBottom: "1px solid #E7E5E4",
  transition: "background-color 0.15s ease",
};

const tdStyle: React.CSSProperties = {
  padding: "11px 14px",
  verticalAlign: "middle",
  color: "#1C1917",
};

const logoBadgeStyle: React.CSSProperties = {
  width: 28,
  height: 22,
  borderRadius: 4,
  backgroundColor: "#FFFFFF",
  border: "1px solid #E7E5E4",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 2,
  flexShrink: 0,
};

const iataBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  backgroundColor: "#F4EFEA",
  color: "#78716C",
  padding: "1px 6px",
  borderRadius: 4,
  display: "inline-block",
  marginTop: 2,
};

const phoneTextStyle: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#1C1917",
  letterSpacing: "0.02em",
};

const supportTextStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: "#1C1917",
  wordBreak: "break-word",
};

const addressTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#44403C",
  lineHeight: 1.4,
  wordBreak: "break-word",
};

const emptyFieldStyle: React.CSSProperties = {
  color: "#A8A29E",
  fontSize: 13,
};

const emptyTdStyle: React.CSSProperties = {
  padding: "36px 16px",
  textAlign: "center",
  color: "#78716C",
  fontSize: 13,
};

const copyBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "#A8A29E",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 3,
  borderRadius: 4,
  flexShrink: 0,
};

const actionIconBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #E7E5E4",
  borderRadius: 6,
  padding: "5px 7px",
  cursor: "pointer",
  color: "#78716C",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const primaryBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  backgroundColor: "#141413",
  color: "#FAF9F5",
  border: "1px solid #141413",
  padding: "8px 14px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const syncBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  backgroundColor: "#FFFFFF",
  color: "#D97757",
  border: "1px solid #FFFFFF",
  padding: "8px 14px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const ghostBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  backgroundColor: "#FAF9F5",
  color: "#1C1917",
  border: "1px solid #E7E5E4",
  padding: "8px 14px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

// Modal Styles
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(20, 20, 19, 0.55)",
  backdropFilter: "blur(2px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 16,
};

const modalBoxStyle: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  borderRadius: 12,
  width: "100%",
  maxWidth: 480,
  boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
  overflow: "hidden",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 20px",
  borderBottom: "1px solid #E7E5E4",
  backgroundColor: "#FAF9F5",
};

const modalTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 700,
  color: "#1C1917",
};

const closeBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "#78716C",
  padding: 4,
};

const formStyle: React.CSSProperties = {
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const formGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#44403C",
};

const inputStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #E7E5E4",
  backgroundColor: "#FAF9F5",
  fontSize: 13,
  color: "#1C1917",
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #E7E5E4",
  backgroundColor: "#FAF9F5",
  fontSize: 13,
  color: "#1C1917",
  outline: "none",
  resize: "vertical",
};

const modalFooterStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 6,
  paddingTop: 14,
  borderTop: "1px solid #E7E5E4",
};
