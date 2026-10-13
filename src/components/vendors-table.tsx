import React, { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
  ExternalLink,
  Check,
  X,
  Loader2,
  Building2,
  Wallet,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Tag,
  FileSpreadsheet,
} from "lucide-react";
import {
  type Vendor,
  listVendorsAdmin,
  createVendor,
  updateVendor,
  deleteVendor,
  toggleVendorStatusAdmin,
  syncVendorsLive,
} from "@/lib/vendors.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

const VENDOR_SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1d5aNDN0mIL7rRpWgDCOAd0l59M8s8EUaUBSpRydxjqw/edit#gid=919527787";

const CATEGORIES = [
  "All",
  "Airline / GDS",
  "Visa / Portal",
  "Hotel",
  "Transport",
  "Umrah / Packages",
  "Vendor",
  "Other",
] as const;

function formatPKR(val: number): string {
  return "Rs " + Number(val || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function cleanPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "92" + digits.slice(1);
  if (digits.startsWith("92")) return digits;
  return digits;
}

export function VendorsTable() {
  const qc = useQueryClient();
  const listFn = useServerFn(listVendorsAdmin);
  const createFn = useServerFn(createVendor);
  const updateFn = useServerFn(updateVendor);
  const deleteFn = useServerFn(deleteVendor);
  const toggleStatusFn = useServerFn(toggleVendorStatusAdmin);
  const syncLiveFn = useServerFn(syncVendorsLive);

  const { data: vendors = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-vendors"],
    queryFn: () => listFn(),
    staleTime: 60 * 1000,
  });

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [syncing, setSyncing] = useState(false);

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Vendor | null>(null);
  const [deleteItem, setDeleteItem] = useState<Vendor | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Airline / GDS");
  const [formContact, setFormContact] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formOpeningBalance, setFormOpeningBalance] = useState("0");
  const [formCurrentBalance, setFormCurrentBalance] = useState("0");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formNotes, setFormNotes] = useState("");

  // Next suggested vendor code
  const nextVendorCode = useMemo(() => {
    let maxNum = 1000;
    vendors.forEach((v) => {
      const match = v.vendor_code?.match(/\d+/);
      if (match) {
        const n = parseInt(match[0], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    return `VND-${maxNum + 1}`;
  }, [vendors]);

  const openAddModal = () => {
    setFormCode(nextVendorCode);
    setFormName("");
    setFormCategory("Airline / GDS");
    setFormContact("");
    setFormPhone("");
    setFormEmail("");
    setFormCity("");
    setFormOpeningBalance("0");
    setFormCurrentBalance("0");
    setFormIsActive(true);
    setFormNotes("");
    setAddModalOpen(true);
  };

  const openEditModal = (v: Vendor) => {
    setEditItem(v);
    setFormCode(v.vendor_code || "");
    setFormName(v.name || "");
    setFormCategory(v.category || "Vendor");
    setFormContact(v.contact_person || "");
    setFormPhone(v.phone || "");
    setFormEmail(v.email || "");
    setFormCity(v.city || "");
    setFormOpeningBalance(String(v.opening_balance ?? 0));
    setFormCurrentBalance(String(v.current_balance ?? 0));
    setFormIsActive(v.is_active !== false);
    setFormNotes(v.notes || "");
  };

  // Filtered rows
  const filteredVendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      // Category filter
      if (selectedCategory !== "All" && v.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (statusFilter === "active" && !v.is_active) return false;
      if (statusFilter === "inactive" && v.is_active) return false;
      // Search
      if (!q) return true;
      return (
        v.vendor_code?.toLowerCase().includes(q) ||
        v.name?.toLowerCase().includes(q) ||
        v.contact_person?.toLowerCase().includes(q) ||
        v.phone?.toLowerCase().includes(q) ||
        v.email?.toLowerCase().includes(q) ||
        v.city?.toLowerCase().includes(q) ||
        v.category?.toLowerCase().includes(q) ||
        v.notes?.toLowerCase().includes(q)
      );
    });
  }, [vendors, search, selectedCategory, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = vendors.length;
    const active = vendors.filter((v) => v.is_active).length;
    const totalOpening = vendors.reduce((sum, v) => sum + (Number(v.opening_balance) || 0), 0);
    const totalCurrent = vendors.reduce((sum, v) => sum + (Number(v.current_balance) || 0), 0);
    return { total, active, totalOpening, totalCurrent };
  }, [vendors]);

  // Mutations
  const createMut = useMutation({
    mutationFn: (data: any) => createFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vendors"] });
      qc.invalidateQueries({ queryKey: ["vendors"] });
      setAddModalOpen(false);
      toast.success("Vendor created and synced to Google Sheets");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create vendor");
    },
  });

  const updateMut = useMutation({
    mutationFn: (data: any) => updateFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vendors"] });
      qc.invalidateQueries({ queryKey: ["vendors"] });
      setEditItem(null);
      toast.success("Vendor updated and synced to Google Sheets");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update vendor");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vendors"] });
      qc.invalidateQueries({ queryKey: ["vendors"] });
      setDeleteItem(null);
      toast.success("Vendor deleted and synced to Google Sheets");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete vendor");
    },
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => toggleStatusFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vendors"] });
      qc.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor status updated");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to toggle status");
    },
  });

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Vendor Name is required");
      return;
    }
    setSaving(true);
    try {
      await createMut.mutateAsync({
        vendor_code: formCode.trim() || nextVendorCode,
        name: formName.trim(),
        category: formCategory.trim() || "Vendor",
        contact_person: formContact.trim() || null,
        phone: formPhone.trim() || null,
        email: formEmail.trim() || null,
        city: formCity.trim() || null,
        opening_balance: parseFloat(formOpeningBalance) || 0,
        current_balance: parseFloat(formCurrentBalance) || 0,
        is_active: formIsActive,
        notes: formNotes.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    if (!formName.trim()) {
      toast.error("Vendor Name is required");
      return;
    }
    setSaving(true);
    try {
      await updateMut.mutateAsync({
        id: editItem.id,
        vendor_code: formCode.trim() || editItem.vendor_code,
        name: formName.trim(),
        category: formCategory.trim() || "Vendor",
        contact_person: formContact.trim() || null,
        phone: formPhone.trim() || null,
        email: formEmail.trim() || null,
        city: formCity.trim() || null,
        opening_balance: parseFloat(formOpeningBalance) || 0,
        current_balance: parseFloat(formCurrentBalance) || 0,
        is_active: formIsActive,
        notes: formNotes.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await syncLiveFn();
      if (res.status === "success") {
        toast.success(`Google Sheet synced successfully (${res.count} vendors)`);
        refetch();
      } else {
        toast.error(`Sync warning: ${res.error || "Check Google Sheets connection"}`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Stat Cards in Rohi Warm Clay */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-[#78716C]">
            <span>Total Vendors</span>
            <Building2 className="h-4 w-4 text-[#D97757]" />
          </div>
          <p className="mt-1 text-2xl font-black tracking-tight text-[#1C1917]">{stats.total}</p>
          <span className="text-[11px] text-[#78716C]">{stats.active} active suppliers</span>
        </div>

        <div className="rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-[#78716C]">
            <span>Active Suppliers</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1 text-2xl font-black tracking-tight text-emerald-700">{stats.active}</p>
          <span className="text-[11px] text-[#78716C]">{stats.total - stats.active} inactive</span>
        </div>

        <div className="rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-[#78716C]">
            <span>Total Opening</span>
            <Wallet className="h-4 w-4 text-[#78716C]" />
          </div>
          <p className="mt-1 text-lg font-black tracking-tight text-[#1C1917] sm:text-xl">
            {formatPKR(stats.totalOpening)}
          </p>
          <span className="text-[11px] text-[#78716C]">Initial ledger sum</span>
        </div>

        <div className="rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-[#78716C]">
            <span>Current Balance</span>
            <Wallet className="h-4 w-4 text-[#D97757]" />
          </div>
          <p className="mt-1 text-lg font-black tracking-tight text-[#D97757] sm:text-xl">
            {formatPKR(stats.totalCurrent)}
          </p>
          <span className="text-[11px] text-[#78716C]">Live outstanding balance</span>
        </div>
      </div>

      {/* Control Bar: Search, Category, Status, Actions */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716C]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, vendor, contact, phone, city…"
              className="h-9 w-full rounded-lg border border-[#E7E5E4] bg-white pl-9 pr-3 text-xs font-medium text-[#1C1917] placeholder:text-[#78716C] focus:border-[#D97757] focus:outline-none focus:ring-1 focus:ring-[#D97757]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#78716C] hover:text-[#1C1917]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 rounded-lg border border-[#E7E5E4] bg-white px-2.5 text-xs font-medium text-[#1C1917] focus:border-[#D97757] focus:outline-none"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat === "All" ? "All Categories" : cat}
              </option>
            ))}
          </select>

          {/* Status Filter Buttons */}
          <div className="inline-flex rounded-lg border border-[#E7E5E4] bg-white p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                statusFilter === "all" ? "bg-[#141413] text-white" : "text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                statusFilter === "active" ? "bg-[#141413] text-white" : "text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("inactive")}
              className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                statusFilter === "inactive" ? "bg-[#141413] text-white" : "text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              Inactive
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#D97757] px-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-[#c66849]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Vendor</span>
          </button>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={syncing}
            title="Instant Live Sync to Google Sheets Vendors tab"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E7E5E4] bg-white px-3 text-xs font-semibold text-[#1C1917] transition-colors hover:bg-[#FAF9F5] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#D97757] ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Syncing…" : "Sync Sheets"}</span>
          </button>

          <a
            href={VENDOR_SPREADSHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Open Vendors Google Sheet"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E7E5E4] bg-white px-3 text-xs font-semibold text-[#1C1917] transition-colors hover:bg-[#FAF9F5]"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Google Sheet</span>
            <ExternalLink className="h-3 w-3 text-[#78716C]" />
          </a>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="overflow-hidden rounded-xl border border-[#E7E5E4] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E7E5E4] bg-[#141413] text-[11px] font-bold uppercase tracking-wider text-white">
                <th className="px-3 py-3 text-center w-24">Code</th>
                <th className="px-4 py-3">Vendor / Supplier</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Contact Person</th>
                <th className="px-3 py-3">Phone / WhatsApp</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">City</th>
                <th className="px-3 py-3 text-right">Opening (PKR)</th>
                <th className="px-3 py-3 text-right">Balance (PKR)</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-3 py-3 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E5E4]">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-[#78716C]">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#D97757]" />
                      <span>Loading vendors catalog…</span>
                    </div>
                  </td>
                </tr>
              ) : filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-[#78716C]">
                    <div className="mx-auto max-w-sm space-y-2">
                      <Building2 className="mx-auto h-8 w-8 text-[#78716C]/60" />
                      <p className="font-semibold text-[#1C1917]">No vendors found</p>
                      <p className="text-[11px]">
                        {search || selectedCategory !== "All" || statusFilter !== "all"
                          ? "Try adjusting your search query or category filter."
                          : "Get started by adding your first vendor or supplier."}
                      </p>
                      <button
                        type="button"
                        onClick={openAddModal}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#D97757] px-3 py-1.5 text-xs font-bold text-white"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Vendor
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVendors.map((vendor) => {
                  const whatsappPhone = vendor.phone ? cleanPhoneForWhatsApp(vendor.phone) : null;
                  return (
                    <tr
                      key={vendor.id}
                      className="transition-colors hover:bg-[#FAF9F5]"
                    >
                      {/* Code */}
                      <td className="px-3 py-3 text-center">
                        <span className="inline-block rounded border border-[#E7E5E4] bg-[#F4EFEA] px-2 py-0.5 font-mono text-[10px] font-bold text-[#141413]">
                          {vendor.vendor_code || "—"}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#1C1917]">{vendor.name}</div>
                        {vendor.notes && (
                          <div className="line-clamp-1 text-[10px] text-[#78716C]">{vendor.notes}</div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF9F5] px-2 py-0.5 text-[10px] font-medium text-[#78716C] border border-[#E7E5E4]">
                          <Tag className="h-2.5 w-2.5 text-[#D97757]" />
                          {vendor.category || "Vendor"}
                        </span>
                      </td>

                      {/* Contact Person */}
                      <td className="px-3 py-3 text-[#1C1917] whitespace-nowrap">
                        {vendor.contact_person || <span className="text-[#78716C]">—</span>}
                      </td>

                      {/* Phone */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {vendor.phone ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[#1C1917]">{vendor.phone}</span>
                            {whatsappPhone && (
                              <a
                                href={`https://wa.me/${whatsappPhone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Chat on WhatsApp"
                                className="text-emerald-600 hover:text-emerald-700"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#78716C]">—</span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {vendor.email ? (
                          <a
                            href={`mailto:${vendor.email}`}
                            className="inline-flex items-center gap-1 text-[#1C1917] hover:text-[#D97757]"
                          >
                            <Mail className="h-3 w-3 text-[#78716C]" />
                            <span className="max-w-[150px] truncate">{vendor.email}</span>
                          </a>
                        ) : (
                          <span className="text-[#78716C]">—</span>
                        )}
                      </td>

                      {/* City */}
                      <td className="px-3 py-3 text-[#1C1917] whitespace-nowrap">
                        {vendor.city ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-[#78716C]" />
                            {vendor.city}
                          </span>
                        ) : (
                          <span className="text-[#78716C]">—</span>
                        )}
                      </td>

                      {/* Opening Balance */}
                      <td className="px-3 py-3 text-right font-mono font-medium text-[#1C1917] whitespace-nowrap">
                        {formatPKR(vendor.opening_balance)}
                      </td>

                      {/* Current Balance */}
                      <td className="px-3 py-3 text-right font-mono font-bold text-[#D97757] whitespace-nowrap">
                        {formatPKR(vendor.current_balance)}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleMut.mutate({ id: vendor.id, is_active: !vendor.is_active })}
                          title="Click to toggle status"
                          className="inline-flex items-center gap-1"
                        >
                          {vendor.is_active ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200 hover:bg-slate-200">
                              <XCircle className="h-2.5 w-2.5" /> Inactive
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(vendor)}
                            className="rounded p-1 text-[#78716C] hover:bg-[#F4EFEA] hover:text-[#1C1917]"
                            title="Edit Vendor"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteItem(vendor)}
                            className="rounded p-1 text-[#78716C] hover:bg-red-50 hover:text-red-600"
                            title="Delete Vendor"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

        {/* Footer info bar */}
        <div className="flex items-center justify-between border-t border-[#E7E5E4] bg-[#FAF9F5] px-4 py-2.5 text-[11px] text-[#78716C]">
          <span>
            Showing <strong className="text-[#1C1917]">{filteredVendors.length}</strong> of{" "}
            <strong className="text-[#1C1917]">{vendors.length}</strong> total registered vendors
          </span>
          <span className="font-medium text-[#78716C]">
            Mirrored to Google Sheets • Vendors workbook
          </span>
        </div>
      </div>

      {/* ADD VENDOR MODAL */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#E7E5E4] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E7E5E4] bg-[#D97757] px-5 py-3.5 text-white">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                <h3 className="text-sm font-bold uppercase tracking-wider">Register New Vendor</h3>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="space-y-4 p-5 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-[#1C1917]">
                    Vendor Code <span className="text-[#78716C] font-normal">(Auto-suggested)</span>
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g. VND-1003"
                    className="h-9 w-full rounded-lg border border-[#E7E5E4] bg-[#FAF9F5] px-3 font-mono text-xs font-bold text-[#1C1917] focus:border-[#D97757] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-[#1C1917]">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[#E7E5E4] bg-white px-3 text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                  >
                    <option value="Airline / GDS">Airline / GDS</option>
                    <option value="Visa / Portal">Visa / Portal</option>
                    <option value="Hotel">Hotel</option>
                    <option value="Transport">Transport</option>
                    <option value="Umrah / Packages">Umrah / Packages</option>
                    <option value="Vendor">Vendor</option>
                    <option value="Direct Supplier">Direct Supplier</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-[#1C1917]">
                  Vendor / Supplier Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Air Sial Direct Portal / Madina Travels"
                  className="h-9 w-full rounded-lg border border-[#E7E5E4] bg-white px-3 text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-[#1C1917]">Contact Person</label>
                  <input
                    type="text"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    placeholder="Full Name"
                    className="h-9 w-full rounded-lg border border-[#E7E5E4] bg-white px-3 text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-[#1C1917]">Phone / WhatsApp</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="0300-1234567"
                    className="h-9 w-full rounded-lg border border-[#E7E5E4] bg-white px-3 text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-[#1C1917]">Email Address</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="vendor@example.com"
                    className="h-9 w-full rounded-lg border border-[#E7E5E4] bg-white px-3 text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-[#1C1917]">City / Location</label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    placeholder="e.g. Rahim Yar Khan / Lahore"
                    className="h-9 w-full rounded-lg border border-[#E7E5E4] bg-white px-3 text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-[#1C1917]">Opening Balance (PKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formOpeningBalance}
                    onChange={(e) => setFormOpeningBalance(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[#E7E5E4] bg-white px-3 font-mono text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-[#1C1917]">Current Balance (PKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formCurrentBalance}
                    onChange={(e) => setFormCurrentBalance(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[#E7E5E4] bg-white px-3 font-mono text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-[#1C1917]">Notes / Remarks</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional portal login notes, address, or payment terms…"
                  className="w-full rounded-lg border border-[#E7E5E4] bg-white p-2.5 text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="add-active"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-[#E7E5E4] text-[#D97757] focus:ring-[#D97757]"
                />
                <label htmlFor="add-active" className="text-xs font-semibold text-[#1C1917]">
                  Active Supplier (Available in ticket & accounts forms)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#E7E5E4] pt-4">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="rounded-lg border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-semibold text-[#78716C] hover:bg-[#FAF9F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#D97757] px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-[#c66849] disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{saving ? "Saving…" : "Save Vendor"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT VENDOR MODAL */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#E7E5E4] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E7E5E4] bg-[#141413] px-5 py-3.5 text-white">
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-[#D97757]" />
                <h3 className="text-sm font-bold uppercase tracking-wider">
                  Edit Vendor • {editItem.vendor_code}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 p-5 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-[#1C1917]">Vendor Code</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[#E7E5E4] bg-[#FAF9F5] px-3 font-mono text-xs font-bold text-[#1C1917] focus:border-[#D97757] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-[#1C1917]">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[#E7E5E4] bg-white px-3 text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                  >
                    <option value="Airline / GDS">Airline / GDS</option>
                    <option value="Visa / Portal">Visa / Portal</option>
                    <option value="Hotel">Hotel</option>
                    <option value="Transport">Transport</option>
                    <option value="Umrah / Packages">Umrah / Packages</option>
                    <option value="Vendor">Vendor</option>
                    <option value="Direct Supplier">Direct Supplier</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-[#1C1917]">
                  Vendor / Supplier Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[#E7E5E4] bg-white px-3 text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-[#1C1917]">Contact Person</label>
                  <input
                    type="text"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[#E7E5E4] bg-white px-3 text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-[#1C1917]">Phone / WhatsApp</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[#E7E5E4] bg-white px-3 text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-[#1C1917]">Email Address</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[#E7E5E4] bg-white px-3 text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-[#1C1917]">City / Location</label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[#E7E5E4] bg-white px-3 text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-[#1C1917]">Opening Balance (PKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formOpeningBalance}
                    onChange={(e) => setFormOpeningBalance(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[#E7E5E4] bg-white px-3 font-mono text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-[#1C1917]">Current Balance (PKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formCurrentBalance}
                    onChange={(e) => setFormCurrentBalance(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[#E7E5E4] bg-white px-3 font-mono text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-[#1C1917]">Notes / Remarks</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full rounded-lg border border-[#E7E5E4] bg-white p-2.5 text-xs text-[#1C1917] focus:border-[#D97757] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit-active"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-[#E7E5E4] text-[#D97757] focus:ring-[#D97757]"
                />
                <label htmlFor="edit-active" className="text-xs font-semibold text-[#1C1917]">
                  Active Supplier
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#E7E5E4] pt-4">
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  className="rounded-lg border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-semibold text-[#78716C] hover:bg-[#FAF9F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#141413] px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-black disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D97757]" />}
                  <span>{saving ? "Saving…" : "Update Vendor"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-100 p-2 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-[#1C1917]">Delete Vendor Record?</h3>
                <p className="mt-1 text-xs text-[#78716C]">
                  Are you sure you want to delete{" "}
                  <strong className="text-[#1C1917]">{deleteItem.name}</strong> (
                  <span className="font-mono">{deleteItem.vendor_code}</span>)? This will also
                  update the Google Sheet mirror.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteItem(null)}
                className="rounded-lg border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-semibold text-[#78716C] hover:bg-[#FAF9F5]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMut.isPending}
                onClick={() => deleteMut.mutate(deleteItem.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{deleteMut.isPending ? "Deleting…" : "Delete Vendor"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
