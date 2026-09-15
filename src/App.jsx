import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase";
import {
  LayoutDashboard, Users, FileText, HardHat, ListChecks, Receipt,
  Wallet, Plus, Search, X, Trash2, Pencil, ArrowRight, Check,
  ChevronDown, Copy, Printer, Building2, TrendingUp, Clock,
  AlertTriangle, CheckCircle2, Circle
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";

/* ---------------------------------- utils --------------------------------- */

const uid = () => Math.random().toString(36).slice(2, 10);
const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    Math.round(n || 0)
  );
const moneyPrecise = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => {
  const dt = new Date(d + "T00:00:00");
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
};

const VAT_RATES = [0, 5.5, 10, 20];
const QUOTE_STATUSES = ["Draft", "Sent", "Viewed", "Accepted", "Declined", "Expired"];
const PROJECT_STATUSES = ["To prepare", "Scheduled", "In progress", "On hold", "Completed", "Cancelled"];
const TASK_STATUSES = ["To do", "In progress", "Done"];
const PRIORITIES = ["Low", "Normal", "High", "Urgent"];
const EXPENSE_CATEGORIES = ["Materials", "Labor", "Transport", "Equipment rental", "Subcontracting", "Other"];

const statusTone = {
  Draft: "gray", Sent: "blue", Viewed: "amber", Accepted: "green", Declined: "red", Expired: "gray",
  "To prepare": "gray", Scheduled: "blue", "In progress": "amber", "On hold": "red",
  Completed: "green", Cancelled: "gray",
  "To do": "gray", Done: "green",
  Low: "gray", Normal: "blue", High: "amber", Urgent: "red",
};

const toneStyles = {
  gray: { bg: "var(--tone-gray-bg)", fg: "var(--tone-gray-fg)" },
  blue: { bg: "var(--tone-blue-bg)", fg: "var(--tone-blue-fg)" },
  amber: { bg: "var(--tone-amber-bg)", fg: "var(--tone-amber-fg)" },
  green: { bg: "var(--tone-green-bg)", fg: "var(--tone-green-fg)" },
  red: { bg: "var(--tone-red-bg)", fg: "var(--tone-red-fg)" },
};

function Pill({ children, tone = "gray" }) {
  const s = toneStyles[tone] || toneStyles.gray;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
        background: s.bg, color: s.fg, whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/* -------------------------------- computed --------------------------------- */

function quoteTotals(quote) {
  let subtotal = 0, vat = 0;
  for (const it of quote.items) {
    const base = (it.qty || 0) * (it.unitPrice || 0);
    const afterDiscount = base * (1 - (it.discountPct || 0) / 100);
    subtotal += afterDiscount;
    vat += afterDiscount * ((it.vatPct || 0) / 100);
  }
  const total = subtotal + vat;
  const deposit = total * ((quote.depositPct || 0) / 100);
  return { subtotal, vat, total, deposit, remaining: total - deposit };
}

function projectFinancials(project) {
  const budget = project.budget || 0;
  const expensesTotal = project.expenses.reduce((s, e) => s + (e.amountHT || 0) * (1 + (e.vatPct || 0) / 100), 0);
  const invoiced = project.invoicedAmount || 0;
  const collected = project.payments.reduce((s, p) => s + (p.amount || 0), 0);
  const remaining = invoiced - collected;
  const margin = invoiced - expensesTotal;
  return { budget, expensesTotal, invoiced, collected, remaining, margin };
}

/* -------------------------------- demo data --------------------------------- */

function seed() {
  const clients = [
    { id: "c1", name: "Laurent Bissette", company: "Bissette Renovations", phone: "(415) 555-0132", email: "laurent@bissette.co", address: "482 Harbor Rd", city: "Oakland", zip: "94607", notes: "Prefers calls after 4pm." },
    { id: "c2", name: "Priya Nair", company: "", phone: "(628) 555-0110", email: "priya.nair@gmail.com", address: "19 Willow Ct", city: "Berkeley", zip: "94702", notes: "" },
    { id: "c3", name: "Marcus Feld", company: "Feld Property Group", phone: "(510) 555-0187", email: "mfeld@feldpg.com", address: "1200 Grand Ave", city: "Emeryville", zip: "94608", notes: "Multi-unit owner, repeat client." },
    { id: "c4", name: "Sofia Mendez", company: "", phone: "(925) 555-0199", email: "sofia.mendez@outlook.com", address: "77 Cedar Ln", city: "Walnut Creek", zip: "94596", notes: "" },
  ];

  const q1items = [
    { id: uid(), description: "Kitchen demolition and haul-away", category: "Labor", qty: 1, unit: "lump sum", unitPrice: 2400, discountPct: 0, vatPct: 10 },
    { id: uid(), description: "Custom oak cabinetry, installed", category: "Materials", qty: 1, unit: "lump sum", unitPrice: 9800, discountPct: 5, vatPct: 10 },
    { id: uid(), description: "Quartz countertop, 42 sq ft", category: "Materials", qty: 42, unit: "sq ft", unitPrice: 85, discountPct: 0, vatPct: 10 },
    { id: uid(), description: "Plumbing rough-in and fixtures", category: "Labor", qty: 1, unit: "lump sum", unitPrice: 3100, discountPct: 0, vatPct: 10 },
  ];
  const q2items = [
    { id: uid(), description: "Roof tear-off, 28 squares", category: "Labor", qty: 28, unit: "sq", unitPrice: 145, discountPct: 0, vatPct: 5.5 },
    { id: uid(), description: "Architectural shingles", category: "Materials", qty: 28, unit: "sq", unitPrice: 210, discountPct: 0, vatPct: 5.5 },
    { id: uid(), description: "Flashing and ventilation kit", category: "Materials", qty: 1, unit: "lump sum", unitPrice: 1650, discountPct: 0, vatPct: 5.5 },
  ];
  const q3items = [
    { id: uid(), description: "Deck framing, pressure-treated", category: "Materials", qty: 320, unit: "sq ft", unitPrice: 22, discountPct: 0, vatPct: 10 },
    { id: uid(), description: "Composite decking install", category: "Labor", qty: 320, unit: "sq ft", unitPrice: 18, discountPct: 0, vatPct: 10 },
  ];
  const q4items = [
    { id: uid(), description: "Bathroom full remodel, standard finish", category: "Labor", qty: 1, unit: "lump sum", unitPrice: 6200, discountPct: 0, vatPct: 10 },
    { id: uid(), description: "Tile and fixtures package", category: "Materials", qty: 1, unit: "lump sum", unitPrice: 3400, discountPct: 8, vatPct: 10 },
  ];

  const quotes = [
    { id: "q1", number: "Q-2026-014", clientId: "c1", date: "2026-08-02", expiryDate: "2026-09-02", subject: "Kitchen renovation", description: "Full kitchen remodel including cabinetry and countertops.", items: q1items, status: "Accepted", depositPct: 30 },
    { id: "q2", number: "Q-2026-021", clientId: "c3", date: "2026-08-18", expiryDate: "2026-09-18", subject: "Roof replacement, Grand Ave building", category: "", description: "Full roof tear-off and replacement for 4-unit property.", items: q2items, status: "Accepted", depositPct: 40 },
    { id: "q3", number: "Q-2026-027", clientId: "c4", date: "2026-08-30", expiryDate: "2026-09-30", subject: "Backyard deck build", description: "New composite deck, 320 sq ft.", items: q3items, status: "Sent", depositPct: 30 },
    { id: "q4", number: "Q-2026-031", clientId: "c2", date: "2026-09-05", expiryDate: "2026-10-05", subject: "Bathroom remodel", description: "Full bathroom remodel, standard finish package.", items: q4items, status: "Draft", depositPct: 30 },
  ];

  const projects = [
    {
      id: "p1", quoteId: "q1", clientId: "c1", name: "Bissette kitchen renovation",
      address: "482 Harbor Rd, Oakland, CA 94607", startDate: "2026-08-10", endDate: "2026-09-25",
      manager: "Dana Wu", budget: 15000, status: "In progress", invoicedAmount: 12000,
      tasks: [
        { id: uid(), title: "Demo existing cabinetry", assignee: "Kevin Ortiz", startDate: "2026-08-10", dueDate: "2026-08-12", priority: "High", status: "Done", progress: 100 },
        { id: uid(), title: "Rough plumbing", assignee: "Dana Wu", startDate: "2026-08-13", dueDate: "2026-08-16", priority: "High", status: "Done", progress: 100 },
        { id: uid(), title: "Install cabinetry", assignee: "Kevin Ortiz", startDate: "2026-08-20", dueDate: "2026-08-27", priority: "Normal", status: "In progress", progress: 60 },
        { id: uid(), title: "Countertop template and install", assignee: "Subcontractor - Stone Works", startDate: "2026-08-28", dueDate: "2026-09-03", priority: "Normal", status: "To do", progress: 0 },
        { id: uid(), title: "Final punch list", assignee: "Dana Wu", startDate: "2026-09-20", dueDate: "2026-09-25", priority: "Urgent", status: "To do", progress: 0 },
      ],
      expenses: [
        { id: uid(), description: "Cabinet order deposit", category: "Materials", amountHT: 4200, vatPct: 10, date: "2026-08-08", supplier: "Millwork Direct" },
        { id: uid(), description: "Demo crew, 2 days", category: "Labor", amountHT: 1400, vatPct: 10, date: "2026-08-12", supplier: "In-house" },
        { id: uid(), description: "Plumbing fixtures", category: "Materials", amountHT: 980, vatPct: 10, date: "2026-08-15", supplier: "Bay Supply Co" },
        { id: uid(), description: "Dumpster rental", category: "Equipment rental", amountHT: 420, vatPct: 10, date: "2026-08-10", supplier: "Waste Away Rentals" },
      ],
      payments: [
        { id: uid(), amount: 5400, date: "2026-08-05", method: "Bank transfer", note: "Deposit" },
        { id: uid(), amount: 4000, date: "2026-08-22", method: "Check", note: "Progress payment" },
      ],
    },
    {
      id: "p2", quoteId: "q2", clientId: "c3", name: "Grand Ave roof replacement",
      address: "1200 Grand Ave, Emeryville, CA 94608", startDate: "2026-09-01", endDate: "2026-09-10",
      manager: "Dana Wu", budget: 12500, status: "Scheduled", invoicedAmount: 4200,
      tasks: [
        { id: uid(), title: "Order materials", assignee: "Dana Wu", startDate: "2026-08-19", dueDate: "2026-08-25", priority: "High", status: "Done", progress: 100 },
        { id: uid(), title: "Schedule crane and crew", assignee: "Dana Wu", startDate: "2026-08-25", dueDate: "2026-08-29", priority: "Normal", status: "In progress", progress: 40 },
        { id: uid(), title: "Tear-off and install", assignee: "Roofing crew A", startDate: "2026-09-01", dueDate: "2026-09-08", priority: "Urgent", status: "To do", progress: 0 },
      ],
      expenses: [
        { id: uid(), description: "Shingle order", category: "Materials", amountHT: 5900, vatPct: 5.5, date: "2026-08-20", supplier: "Roofers Wholesale" },
      ],
      payments: [
        { id: uid(), amount: 4200, date: "2026-08-22", method: "Bank transfer", note: "Deposit" },
      ],
    },
    {
      id: "p3", quoteId: null, clientId: "c2", name: "Nair fence repair",
      address: "19 Willow Ct, Berkeley, CA 94702", startDate: "2026-07-14", endDate: "2026-07-18",
      manager: "Kevin Ortiz", budget: 1800, status: "Completed", invoicedAmount: 1750,
      tasks: [
        { id: uid(), title: "Replace fence panels", assignee: "Kevin Ortiz", startDate: "2026-07-14", dueDate: "2026-07-17", priority: "Normal", status: "Done", progress: 100 },
      ],
      expenses: [
        { id: uid(), description: "Cedar fence panels", category: "Materials", amountHT: 620, vatPct: 10, date: "2026-07-12", supplier: "Bay Supply Co" },
        { id: uid(), description: "Labor, 3 days", category: "Labor", amountHT: 900, vatPct: 10, date: "2026-07-18", supplier: "In-house" },
      ],
      payments: [
        { id: uid(), amount: 1750, date: "2026-07-19", method: "Check", note: "Paid in full" },
      ],
    },
  ];

  return { clients, quotes, projects };
}

/* --------------------------------- storage ---------------------------------- */

const STORAGE_KEY = "siteflow-data-v1";

function useStore() {

  const [data, setData] = useState(null);

  const [ready, setReady] = useState(false);

  useEffect(() => {

    (async () => {

      try {

        const { data: row, error } = await supabase
          .from("siteflow_data")
          .select("data")
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        setData(row?.data || seed());

      } catch (error) {

        console.error("Erreur Supabase :", error);

        setData(seed());

      }

      setReady(true);

    })();

  }, []);

  useEffect(() => {

    if (!ready || !data) return;

    const t = setTimeout(async () => {

      try {

        const { data: existing } = await supabase
          .from("siteflow_data")
          .select("id")
          .limit(1)
          .maybeSingle();

        if (existing?.id) {

          await supabase
            .from("siteflow_data")
            .update({ data })
            .eq("id", existing.id);

        } else {

          await supabase
            .from("siteflow_data")
            .insert({ data });

        }

      } catch (error) {

        console.error("Erreur de sauvegarde Supabase :", error);

      }

    }, 400);

    return () => clearTimeout(t);

  }, [data, ready]);

  return [data, setData, ready];

}

/* ---------------------------------- shell ------------------------------------ */

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "clients", label: "Clients", icon: Users },
  { key: "quotes", label: "Quotes", icon: FileText },
  { key: "projects", label: "Projects", icon: HardHat },
];

export default function App() {
  const [data, setData, ready] = useStore();
  const [view, setView] = useState({ page: "dashboard", id: null });
  const [query, setQuery] = useState("");

  const searchResults = useMemo(() => {
    if (!data || !query.trim()) return null;
    const q = query.toLowerCase();
    const clients = data.clients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
    const quotes = data.quotes.filter(
      (qt) => qt.number.toLowerCase().includes(q) || qt.subject.toLowerCase().includes(q)
    );
    const projects = data.projects.filter((p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q));
    return { clients, quotes, projects };
  }, [query, data]);

  if (!ready || !data) {
    return (
      <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center", height: 480 }}>
        <div style={{ color: "var(--muted)", fontSize: 14 }}>Loading SiteFlow…</div>
      </div>
    );
  }

  const goto = (page, id = null) => setView({ page, id });

  return (
    <div style={pageStyle}>
      <style>{`
        :root {
          --ink: #17212B; --ink-2: #212D3B; --paper: #F4F6F5; --card: #FFFFFF;
          --border-c: #E3E7E6; --muted: #6B7680; --text: #17212B; --accent: #C9781F;
          --accent-ink: #7A4711;
          --tone-gray-bg: #EDEFEF; --tone-gray-fg: #565F66;
          --tone-blue-bg: #E4EEF7; --tone-blue-fg: #29607F;
          --tone-amber-bg: #FBEFDB; --tone-amber-fg: #93611A;
          --tone-green-bg: #E4F0E6; --tone-green-fg: #2E6E45;
          --tone-red-bg: #F8E7E5; --tone-red-fg: #A23F32;
        }
        .sf-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .sf-scroll::-webkit-scrollbar-thumb { background: #D8DBDA; border-radius: 8px; }
        .sf-input, .sf-select, .sf-textarea {
          border: 1px solid var(--border-c); border-radius: 6px; padding: 8px 10px;
          font-size: 13.5px; font-family: inherit; background: #fff; color: var(--text);
          width: 100%; box-sizing: border-box;
        }
        .sf-input:focus, .sf-select:focus, .sf-textarea:focus { outline: 2px solid #D9B78A; outline-offset: 0; border-color: var(--accent); }
        .sf-btn {
          display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600;
          padding: 8px 14px; border-radius: 6px; border: 1px solid var(--border-c); background: #fff;
          color: var(--text); cursor: pointer; white-space: nowrap;
        }
        .sf-btn:hover { border-color: #C7CBCA; background: #FAFBFA; }
        .sf-btn-primary { background: var(--ink); color: #fff; border-color: var(--ink); }
        .sf-btn-primary:hover { background: var(--ink-2); border-color: var(--ink-2); }
        .sf-btn-danger { color: #A23F32; }
        .sf-row-hover:hover { background: #FAFAF9; }
        table.sf-table { border-collapse: collapse; width: 100%; }
        table.sf-table th { text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em;
          color: var(--muted); font-weight: 600; padding: 10px 14px; border-bottom: 1px solid var(--border-c); }
        table.sf-table td { padding: 12px 14px; font-size: 13.5px; border-bottom: 1px solid #EEF0EF; vertical-align: middle; }
        table.sf-table tr:last-child td { border-bottom: none; }
        .sf-table-wrap { overflow-x: auto; }

        /* ---------- phone layout ---------- */
        .sf-shell { display: flex; min-height: 640px; border-radius: 14px; overflow: hidden; border: 1px solid var(--border-c); }
        .sf-sidebar { width: 220px; background: var(--ink); color: #EDEFEE; display: flex; flex-direction: column; flex-shrink: 0; }
        .sf-sidebar-brand { padding: 20px 18px 16px; display: flex; align-items: center; gap: 9px; }
        .sf-nav { padding: 6px 10px; display: flex; flex-direction: column; gap: 2px; }
        .sf-nav-btn { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 7px; border: none; cursor: pointer; font-size: 13.5px; font-weight: 500; text-align: left; background: transparent; color: #B8C0C6; }
        .sf-nav-btn.active { background: rgba(255,255,255,0.1); color: #fff; }
        .sf-sidebar-footer { margin-top: auto; padding: 16px; border-top: 1px solid rgba(255,255,255,0.08); }
        .sf-main { flex: 1; background: var(--paper); display: flex; flex-direction: column; min-width: 0; }
        .sf-topbar { padding: 16px 24px; border-bottom: 1px solid var(--border-c); background: #fff; display: flex; align-items: center; gap: 16px; }
        .sf-content { flex: 1; overflow-y: auto; padding: 24px; }

        @media (max-width: 760px) {
          .sf-shell { flex-direction: column; min-height: unset; border-radius: 10px; }
          .sf-sidebar { width: 100%; flex-direction: row; align-items: center; order: 2;
            position: sticky; bottom: 0; z-index: 20; padding: 4px 6px; border-top: 1px solid rgba(255,255,255,0.1); }
          .sf-sidebar-brand, .sf-sidebar-footer { display: none; }
          .sf-nav { flex-direction: row; width: 100%; padding: 2px; gap: 0; justify-content: space-around; }
          .sf-nav-btn { flex-direction: column; gap: 3px; font-size: 10.5px; padding: 7px 4px; flex: 1; text-align: center; justify-content: center; }
          .sf-main { order: 1; }
          .sf-topbar { padding: 12px 14px; }
          .sf-content { padding: 14px; }
          .sf-cols-multi { grid-template-columns: repeat(2, 1fr) !important; }
          .sf-cols-two, .sf-cols-asym { grid-template-columns: 1fr !important; }
          table.sf-table { min-width: 560px; }
        }
        @media (max-width: 420px) {
          .sf-cols-multi { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="sf-shell">
        {/* Sidebar */}
        <div className="sf-sidebar">
          <div className="sf-sidebar-brand">
            <div style={{ width: 26, height: 26, borderRadius: 6, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <HardHat size={15} color="#241505" strokeWidth={2.4} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>SiteFlow</div>
          </div>
          <nav className="sf-nav">
            {NAV.map((n) => {
              const active = view.page === n.key;
              const Icon = n.icon;
              return (
                <button
                  key={n.key}
                  onClick={() => goto(n.key)}
                  className={"sf-nav-btn" + (active ? " active" : "")}
                >
                  <Icon size={16} strokeWidth={2} />
                  {n.label}
                </button>
              );
            })}
          </nav>
          <div className="sf-sidebar-footer">
            <div style={{ fontSize: 12, color: "#8B959C" }}>Signed in as</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>Dana Wu</div>
            <div style={{ fontSize: 11.5, color: "#8B959C" }}>Northgate Builders</div>
          </div>
        </div>

        {/* Main */}
        <div className="sf-main">
          <div className="sf-topbar">
            <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
              <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: "var(--muted)" }} />
              <input
                className="sf-input"
                style={{ paddingLeft: 30 }}
                placeholder="Search clients, quotes, projects…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--muted)", whiteSpace: "nowrap" }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </div>
          </div>

          <div className="sf-scroll sf-content">
            {searchResults ? (
              <SearchResultsView results={searchResults} goto={goto} clearSearch={() => setQuery("")} query={query} />
            ) : view.page === "dashboard" ? (
              <Dashboard data={data} goto={goto} />
            ) : view.page === "clients" ? (
              <ClientsPage data={data} setData={setData} view={view} goto={goto} />
            ) : view.page === "quotes" ? (
              <QuotesPage data={data} setData={setData} view={view} goto={goto} />
            ) : view.page === "projects" ? (
              <ProjectsPage data={data} setData={setData} view={view} goto={goto} />
            ) : null}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
        Demo data only, stored privately in your browser session. No real client or payment information.
      </p>
    </div>
  );
}

const pageStyle = { fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif", color: "var(--text)", maxWidth: 1180, margin: "0 auto" };

function SectionTitle({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border-c)", borderRadius: 10, ...style }}>
      {children}
    </div>
  );
}

/* -------------------------------- search view -------------------------------- */

function SearchResultsView({ results, goto, clearSearch, query }) {
  const { clients, quotes, projects } = results;
  const total = clients.length + quotes.length + projects.length;
  return (
    <div>
      <SectionTitle title={`Results for "${query}"`} subtitle={`${total} match${total === 1 ? "" : "es"}`} action={
        <button className="sf-btn" onClick={clearSearch}><X size={14} />Clear</button>
      } />
      {total === 0 && <Card style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Nothing found. Try a different search.</Card>}
      {clients.length > 0 && (
        <ResultGroup title="Clients">
          {clients.map((c) => (
            <ResultRow key={c.id} title={c.name} subtitle={c.company || c.email} onClick={() => { goto("clients", c.id); clearSearch(); }} />
          ))}
        </ResultGroup>
      )}
      {quotes.length > 0 && (
        <ResultGroup title="Quotes">
          {quotes.map((q) => (
            <ResultRow key={q.id} title={`${q.number} — ${q.subject}`} subtitle={q.status} onClick={() => { goto("quotes", q.id); clearSearch(); }} />
          ))}
        </ResultGroup>
      )}
      {projects.length > 0 && (
        <ResultGroup title="Projects">
          {projects.map((p) => (
            <ResultRow key={p.id} title={p.name} subtitle={p.address} onClick={() => { goto("projects", p.id); clearSearch(); }} />
          ))}
        </ResultGroup>
      )}
    </div>
  );
}
function ResultGroup({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>{title}</div>
      <Card>{children}</Card>
    </div>
  );
}
function ResultRow({ title, subtitle, onClick }) {
  return (
    <button onClick={onClick} className="sf-row-hover" style={{ width: "100%", textAlign: "left", display: "flex", flexDirection: "column", gap: 2, padding: "12px 14px", border: "none", borderBottom: "1px solid #EEF0EF", background: "transparent", cursor: "pointer" }}>
      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{subtitle}</span>
    </button>
  );
}

/* --------------------------------- dashboard ---------------------------------- */

function Dashboard({ data, goto }) {
  const { clients, quotes, projects } = data;

  const stats = useMemo(() => {
    const revenue = quotes.filter((q) => q.status === "Accepted").reduce((s, q) => s + quoteTotals(q).total, 0);
    const pendingQuotes = quotes.filter((q) => q.status === "Sent" || q.status === "Viewed").length;
    const acceptedQuotes = quotes.filter((q) => q.status === "Accepted").length;
    const activeProjects = projects.filter((p) => ["In progress", "Scheduled", "To prepare", "On hold"].includes(p.status)).length;
    const completedProjects = projects.filter((p) => p.status === "Completed").length;
    const pendingPayments = projects.reduce((s, p) => {
      const f = projectFinancials(p);
      return s + Math.max(f.remaining, 0);
    }, 0);
    const monthExpenses = projects.reduce((s, p) => s + p.expenses.reduce((s2, e) => s2 + e.amountHT * (1 + e.vatPct / 100), 0), 0);
    const estProfit = projects.reduce((s, p) => s + projectFinancials(p).margin, 0);
    return { revenue, pendingQuotes, acceptedQuotes, activeProjects, completedProjects, pendingPayments, monthExpenses, estProfit };
  }, [quotes, projects]);

  const chartData = [
    { month: "Apr", revenue: 18200 }, { month: "May", revenue: 21400 }, { month: "Jun", revenue: 19800 },
    { month: "Jul", revenue: 24600 }, { month: "Aug", revenue: 27300 }, { month: "Sep", revenue: Math.round(stats.revenue) || 15200 },
  ];

  const clientName = (id) => clients.find((c) => c.id === id)?.name || "—";

  const urgentTasks = projects
    .flatMap((p) => p.tasks.map((t) => ({ ...t, projectName: p.name, projectId: p.id })))
    .filter((t) => t.status !== "Done" && (t.priority === "Urgent" || t.priority === "High"))
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
    .slice(0, 5);

  const recentProjects = [...projects].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || "")).slice(0, 5);

  return (
    <div>
      <SectionTitle title="Dashboard" subtitle="Your business at a glance" />

      <div className="sf-cols-multi" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
        <StatCard label="Revenue (accepted quotes)" value={money(stats.revenue)} icon={TrendingUp} />
        <StatCard label="Quotes pending response" value={stats.pendingQuotes} icon={FileText} />
        <StatCard label="Quotes accepted" value={stats.acceptedQuotes} icon={CheckCircle2} />
        <StatCard label="Active projects" value={stats.activeProjects} icon={HardHat} />
      </div>
      <div className="sf-cols-multi" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Projects completed" value={stats.completedProjects} icon={Check} />
        <StatCard label="Payments outstanding" value={money(stats.pendingPayments)} icon={Wallet} tone="amber" />
        <StatCard label="Recorded expenses" value={money(stats.monthExpenses)} icon={Receipt} />
        <StatCard label="Estimated profit" value={money(stats.estProfit)} icon={TrendingUp} tone={stats.estProfit >= 0 ? "green" : "red"} />
      </div>

      <div className="sf-cols-asym" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginBottom: 14 }}>
        <Card style={{ padding: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Revenue trend</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Accepted quote value by month</div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: -18, right: 8, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C9781F" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#C9781F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#EEF0EF" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6B7680" }} axisLine={{ stroke: "#E3E7E6" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7680" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} width={40} />
                <Tooltip formatter={(v) => money(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E3E7E6" }} />
                <Area type="monotone" dataKey="revenue" stroke="#C9781F" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card style={{ padding: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Urgent tasks</div>
          {urgentTasks.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>Nothing urgent right now.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {urgentTasks.map((t) => (
              <button key={t.id} onClick={() => goto("projects", t.projectId)} style={{ textAlign: "left", border: "none", background: "transparent", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start", padding: 0 }}>
                <AlertTriangle size={14} color={t.priority === "Urgent" ? "#A23F32" : "#93611A"} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t.title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{t.projectName} · due {fmtDate(t.dueDate)}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-c)", fontSize: 13.5, fontWeight: 700 }}>Recent projects</div>
        <div className="sf-table-wrap"><table className="sf-table">
          <thead>
            <tr><th>Project</th><th>Client</th><th>Status</th><th>Progress</th><th>Budget</th></tr>
          </thead>
          <tbody>
            {recentProjects.map((p) => (
              <tr key={p.id} className="sf-row-hover" style={{ cursor: "pointer" }} onClick={() => goto("projects", p.id)}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td>{clientName(p.clientId)}</td>
                <td><Pill tone={statusTone[p.status]}>{p.status}</Pill></td>
                <td>{taskProgress(p)}%</td>
                <td>{money(p.budget)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>
    </div>
  );
}

function taskProgress(project) {
  if (!project.tasks.length) return 0;
  const avg = project.tasks.reduce((s, t) => s + (t.status === "Done" ? 100 : t.progress || 0), 0) / project.tasks.length;
  return Math.round(avg);
}

function StatCard({ label, value, icon: Icon, tone }) {
  const color = tone === "amber" ? "#93611A" : tone === "green" ? "#2E6E45" : tone === "red" ? "#A23F32" : "var(--text)";
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</span>
        <Icon size={14} color="var(--muted)" />
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color, letterSpacing: "-0.01em" }}>{value}</div>
    </Card>
  );
}

/* --------------------------------- clients ---------------------------------- */

function ClientsPage({ data, setData, view, goto }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // client object or "new"
  const selected = view.id ? data.clients.find((c) => c.id === view.id) : null;

  const filtered = data.clients.filter((c) =>
    (c.name + c.company + c.email).toLowerCase().includes(search.toLowerCase())
  );

  const saveClient = (client) => {
    setData((d) => {
      const exists = d.clients.some((c) => c.id === client.id);
      const clients = exists ? d.clients.map((c) => (c.id === client.id ? client : c)) : [...d.clients, client];
      return { ...d, clients };
    });
    setEditing(null);
  };
  const deleteClient = (id) => {
    setData((d) => ({ ...d, clients: d.clients.filter((c) => c.id !== id) }));
    goto("clients");
  };

  if (selected) {
    const quotes = data.quotes.filter((q) => q.clientId === selected.id);
    const projects = data.projects.filter((p) => p.clientId === selected.id);
    return (
      <div>
        <button className="sf-btn" style={{ marginBottom: 14 }} onClick={() => goto("clients")}>← Back to clients</button>
        <SectionTitle
          title={selected.name}
          subtitle={selected.company || selected.email}
          action={
            <div style={{ display: "flex", gap: 8 }}>
              <button className="sf-btn" onClick={() => setEditing(selected)}><Pencil size={14} />Edit</button>
              <button className="sf-btn sf-btn-danger" onClick={() => deleteClient(selected.id)}><Trash2 size={14} />Delete</button>
            </div>
          }
        />
        <div className="sf-cols-asym" style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 14 }}>
          <Card style={{ padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Contact details</div>
            <DetailRow label="Phone" value={selected.phone} />
            <DetailRow label="Email" value={selected.email} />
            <DetailRow label="Address" value={selected.address} />
            <DetailRow label="City" value={`${selected.city} ${selected.zip}`} />
            {selected.notes && <DetailRow label="Notes" value={selected.notes} />}
          </Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Card style={{ padding: 0 }}>
              <div style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, borderBottom: "1px solid var(--border-c)" }}>Quotes ({quotes.length})</div>
              {quotes.length === 0 ? <EmptyRow text="No quotes yet." /> : quotes.map((q) => (
                <button key={q.id} onClick={() => goto("quotes", q.id)} className="sf-row-hover" style={{ width: "100%", display: "flex", justifyContent: "space-between", padding: "10px 16px", border: "none", background: "transparent", borderBottom: "1px solid #EEF0EF", cursor: "pointer", fontSize: 13 }}>
                  <span>{q.number} — {q.subject}</span>
                  <Pill tone={statusTone[q.status]}>{q.status}</Pill>
                </button>
              ))}
            </Card>
            <Card style={{ padding: 0 }}>
              <div style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, borderBottom: "1px solid var(--border-c)" }}>Projects ({projects.length})</div>
              {projects.length === 0 ? <EmptyRow text="No projects yet." /> : projects.map((p) => (
                <button key={p.id} onClick={() => goto("projects", p.id)} className="sf-row-hover" style={{ width: "100%", display: "flex", justifyContent: "space-between", padding: "10px 16px", border: "none", background: "transparent", borderBottom: "1px solid #EEF0EF", cursor: "pointer", fontSize: 13 }}>
                  <span>{p.name}</span>
                  <Pill tone={statusTone[p.status]}>{p.status}</Pill>
                </button>
              ))}
            </Card>
          </div>
        </div>
        {editing && <ClientModal client={editing} onClose={() => setEditing(null)} onSave={saveClient} />}
      </div>
    );
  }

  return (
    <div>
      <SectionTitle
        title="Clients"
        subtitle={`${data.clients.length} total`}
        action={<button className="sf-btn sf-btn-primary" onClick={() => setEditing("new")}><Plus size={14} />Add client</button>}
      />
      <div style={{ position: "relative", maxWidth: 320, marginBottom: 14 }}>
        <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--muted)" }} />
        <input className="sf-input" style={{ paddingLeft: 28 }} placeholder="Search clients…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Card style={{ padding: 0 }}>
        <div className="sf-table-wrap"><table className="sf-table">
          <thead><tr><th>Name</th><th>Company</th><th>Phone</th><th>Email</th><th>City</th></tr></thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="sf-row-hover" style={{ cursor: "pointer" }} onClick={() => goto("clients", c.id)}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td>{c.company || "—"}</td>
                <td>{c.phone}</td>
                <td>{c.email}</td>
                <td>{c.city}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5}><EmptyRow text="No clients match your search." /></td></tr>}
          </tbody>
        </table></div>
      </Card>
      {editing && (
        <ClientModal
          client={editing === "new" ? { id: uid(), name: "", company: "", phone: "", email: "", address: "", city: "", zip: "", notes: "" } : editing}
          onClose={() => setEditing(null)}
          onSave={saveClient}
        />
      )}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F0F2F1", fontSize: 13 }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: "right", maxWidth: "70%" }}>{value || "—"}</span>
    </div>
  );
}
function EmptyRow({ text }) {
  return <div style={{ padding: "20px 16px", fontSize: 13, color: "var(--muted)", textAlign: "center" }}>{text}</div>;
}

function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,24,27,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 12, width, maxWidth: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--border-c)" }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)", padding: 4 }}><X size={18} /></button>
        </div>
        <div className="sf-scroll" style={{ padding: 18, overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function ClientModal({ client, onClose, onSave }) {
  const [form, setForm] = useState(client);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.name.trim().length > 0;
  return (
    <Modal title={client.name ? "Edit client" : "Add client"} onClose={onClose}>
      <div className="sf-cols-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Full name"><input className="sf-input" value={form.name} onChange={set("name")} placeholder="Jane Carter" /></Field>
        <Field label="Company (optional)"><input className="sf-input" value={form.company} onChange={set("company")} placeholder="Carter Holdings" /></Field>
        <Field label="Phone"><input className="sf-input" value={form.phone} onChange={set("phone")} placeholder="(555) 555-0100" /></Field>
        <Field label="Email"><input className="sf-input" value={form.email} onChange={set("email")} placeholder="jane@example.com" /></Field>
      </div>
      <Field label="Address"><input className="sf-input" value={form.address} onChange={set("address")} placeholder="123 Main St" /></Field>
      <div className="sf-cols-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="City"><input className="sf-input" value={form.city} onChange={set("city")} /></Field>
        <Field label="ZIP code"><input className="sf-input" value={form.zip} onChange={set("zip")} /></Field>
      </div>
      <Field label="Notes"><textarea className="sf-textarea" rows={3} value={form.notes} onChange={set("notes")} /></Field>
      {!valid && <div style={{ fontSize: 12.5, color: "#A23F32", marginBottom: 10 }}>Enter a name to save this client.</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
        <button className="sf-btn" onClick={onClose}>Cancel</button>
        <button className="sf-btn sf-btn-primary" disabled={!valid} style={{ opacity: valid ? 1 : 0.5 }} onClick={() => valid && onSave(form)}>Save client</button>
      </div>
    </Modal>
  );
}

/* --------------------------------- quotes ---------------------------------- */

function QuotesPage({ data, setData, view, goto }) {
  const [filter, setFilter] = useState("All");
  const [editingId, setEditingId] = useState(null); // quote id or "new"
  const selected = view.id ? data.quotes.find((q) => q.id === view.id) : null;

  const clientName = (id) => data.clients.find((c) => c.id === id)?.name || "Unknown client";

  const saveQuote = (quote) => {
    setData((d) => {
      const exists = d.quotes.some((q) => q.id === quote.id);
      const quotes = exists ? d.quotes.map((q) => (q.id === quote.id ? quote : q)) : [...d.quotes, quote];
      return { ...d, quotes };
    });
    setEditingId(null);
  };
  const deleteQuote = (id) => {
    setData((d) => ({ ...d, quotes: d.quotes.filter((q) => q.id !== id) }));
    goto("quotes");
  };
  const duplicateQuote = (q) => {
    const copy = { ...q, id: uid(), number: q.number + "-copy", status: "Draft", date: todayISO(), items: q.items.map((it) => ({ ...it, id: uid() })) };
    setData((d) => ({ ...d, quotes: [...d.quotes, copy] }));
  };
  const setStatus = (id, status) => setData((d) => ({ ...d, quotes: d.quotes.map((q) => (q.id === id ? { ...q, status } : q)) }));

  const convertToProject = (q) => {
    const client = data.clients.find((c) => c.id === q.clientId);
    const totals = quoteTotals(q);
    const project = {
      id: uid(), quoteId: q.id, clientId: q.clientId, name: q.subject, address: client ? `${client.address}, ${client.city} ${client.zip}` : "",
      startDate: todayISO(), endDate: addDays(todayISO(), 21), manager: "", budget: Math.round(totals.total),
      status: "To prepare", invoicedAmount: 0, tasks: [], expenses: [], payments: [],
    };
    setData((d) => ({ ...d, projects: [...d.projects, project] }));
    goto("projects", project.id);
  };

  if (editingId) {
    const quote = editingId === "new"
      ? { id: uid(), number: `Q-${new Date().getFullYear()}-${String(data.quotes.length + 1).padStart(3, "0")}`, clientId: data.clients[0]?.id || "", date: todayISO(), expiryDate: addDays(todayISO(), 30), subject: "", description: "", items: [], status: "Draft", depositPct: 30 }
      : data.quotes.find((q) => q.id === editingId);
    return <QuoteEditor quote={quote} clients={data.clients} onCancel={() => setEditingId(null)} onSave={saveQuote} />;
  }

  if (selected) {
    const totals = quoteTotals(selected);
    return (
      <div>
        <button className="sf-btn" style={{ marginBottom: 14 }} onClick={() => goto("quotes")}>← Back to quotes</button>
        <SectionTitle
          title={selected.number}
          subtitle={selected.subject}
          action={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="sf-btn" onClick={() => setEditingId(selected.id)}><Pencil size={14} />Edit</button>
              <button className="sf-btn" onClick={() => duplicateQuote(selected)}><Copy size={14} />Duplicate</button>
              <button className="sf-btn" onClick={() => window.print()}><Printer size={14} />Print</button>
              {selected.status === "Accepted" && (
                <button className="sf-btn sf-btn-primary" onClick={() => convertToProject(selected)}><ArrowRight size={14} />Convert to project</button>
              )}
              <button className="sf-btn sf-btn-danger" onClick={() => deleteQuote(selected.id)}><Trash2 size={14} /></button>
            </div>
          }
        />
        <div className="sf-cols-asym" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14 }}>
          <Card style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Bill to</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{clientName(selected.clientId)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Issued {fmtDate(selected.date)}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Expires {fmtDate(selected.expiryDate)}</div>
              </div>
            </div>
            {selected.description && <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>{selected.description}</p>}
            <div className="sf-table-wrap"><table className="sf-table">
              <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Disc.</th><th>VAT</th><th style={{ textAlign: "right" }}>Line total</th></tr></thead>
              <tbody>
                {selected.items.map((it) => {
                  const base = it.qty * it.unitPrice * (1 - it.discountPct / 100);
                  return (
                    <tr key={it.id}>
                      <td>{it.description}</td>
                      <td>{it.qty} {it.unit}</td>
                      <td>{moneyPrecise(it.unitPrice)}</td>
                      <td>{it.discountPct}%</td>
                      <td>{it.vatPct}%</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{moneyPrecise(base)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
            <div style={{ marginTop: 16, marginLeft: "auto", maxWidth: 260 }}>
              <TotalRow label="Subtotal" value={moneyPrecise(totals.subtotal)} />
              <TotalRow label="VAT" value={moneyPrecise(totals.vat)} />
              <TotalRow label="Total" value={moneyPrecise(totals.total)} bold />
              <TotalRow label={`Deposit (${selected.depositPct}%)`} value={moneyPrecise(totals.deposit)} />
              <TotalRow label="Balance due" value={moneyPrecise(totals.remaining)} bold />
            </div>
          </Card>
          <Card style={{ padding: 18, alignSelf: "start" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Status</div>
            <select className="sf-select" value={selected.status} onChange={(e) => setStatus(selected.id, e.target.value)}>
              {QUOTE_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <div style={{ marginTop: 14 }}>
              <Pill tone={statusTone[selected.status]}>{selected.status}</Pill>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const filtered = data.quotes.filter((q) => filter === "All" || q.status === filter);

  return (
    <div>
      <SectionTitle
        title="Quotes"
        subtitle={`${data.quotes.length} total`}
        action={<button className="sf-btn sf-btn-primary" onClick={() => setEditingId("new")}><Plus size={14} />New quote</button>}
      />
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {["All", ...QUOTE_STATUSES].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className="sf-btn" style={{ background: filter === s ? "var(--ink)" : "#fff", color: filter === s ? "#fff" : "var(--text)", borderColor: filter === s ? "var(--ink)" : "var(--border-c)" }}>{s}</button>
        ))}
      </div>
      <Card style={{ padding: 0 }}>
        <div className="sf-table-wrap"><table className="sf-table">
          <thead><tr><th>Number</th><th>Client</th><th>Subject</th><th>Date</th><th>Status</th><th style={{ textAlign: "right" }}>Total</th></tr></thead>
          <tbody>
            {filtered.map((q) => {
              const t = quoteTotals(q);
              return (
                <tr key={q.id} className="sf-row-hover" style={{ cursor: "pointer" }} onClick={() => goto("quotes", q.id)}>
                  <td style={{ fontWeight: 600 }}>{q.number}</td>
                  <td>{clientName(q.clientId)}</td>
                  <td>{q.subject}</td>
                  <td>{fmtDate(q.date)}</td>
                  <td><Pill tone={statusTone[q.status]}>{q.status}</Pill></td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{moneyPrecise(t.total)}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={6}><EmptyRow text="No quotes in this status." /></td></tr>}
          </tbody>
        </table></div>
      </Card>
    </div>
  );
}

function TotalRow({ label, value, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 500, borderTop: bold ? "1px solid var(--border-c)" : "none", marginTop: bold ? 4 : 0, paddingTop: bold ? 10 : 6 }}>
      <span style={{ color: bold ? "var(--text)" : "var(--muted)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function QuoteEditor({ quote, clients, onCancel, onSave }) {
  const [form, setForm] = useState(quote);
  const totals = quoteTotals(form);
  const valid = form.clientId && form.subject.trim() && form.items.length > 0;

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const updateItem = (id, patch) => setForm((f) => ({ ...f, items: f.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { id: uid(), description: "", category: "Materials", qty: 1, unit: "unit", unitPrice: 0, discountPct: 0, vatPct: 10 }] }));
  const removeItem = (id) => setForm((f) => ({ ...f, items: f.items.filter((it) => it.id !== id) }));

  return (
    <div>
      <button className="sf-btn" style={{ marginBottom: 14 }} onClick={onCancel}>← Cancel</button>
      <SectionTitle title={quote.number ? `Edit ${quote.number}` : "New quote"} subtitle="Build the quote and see totals update live" />
      <div className="sf-cols-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
        <Field label="Client">
          <select className="sf-select" value={form.clientId} onChange={setField("clientId")}>
            <option value="">Select a client</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Subject"><input className="sf-input" value={form.subject} onChange={setField("subject")} placeholder="Kitchen renovation" /></Field>
        <Field label="Quote date"><input type="date" className="sf-input" value={form.date} onChange={setField("date")} /></Field>
        <Field label="Expiry date"><input type="date" className="sf-input" value={form.expiryDate} onChange={setField("expiryDate")} /></Field>
      </div>
      <Field label="Description"><textarea className="sf-textarea" rows={2} value={form.description} onChange={setField("description")} /></Field>

      <div style={{ fontSize: 13, fontWeight: 700, margin: "18px 0 8px" }}>Line items</div>
      <Card style={{ padding: 0, marginBottom: 12 }}>
        <div className="sf-table-wrap"><table className="sf-table">
          <thead>
            <tr><th style={{ minWidth: 180 }}>Description</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Disc %</th><th>VAT %</th><th style={{ textAlign: "right" }}>Total</th><th></th></tr>
          </thead>
          <tbody>
            {form.items.map((it) => {
              const lineTotal = it.qty * it.unitPrice * (1 - it.discountPct / 100) * (1 + it.vatPct / 100);
              return (
                <tr key={it.id}>
                  <td><input className="sf-input" value={it.description} onChange={(e) => updateItem(it.id, { description: e.target.value })} placeholder="Item description" /></td>
                  <td style={{ width: 70 }}><input type="number" className="sf-input" value={it.qty} onChange={(e) => updateItem(it.id, { qty: parseFloat(e.target.value) || 0 })} /></td>
                  <td style={{ width: 90 }}><input className="sf-input" value={it.unit} onChange={(e) => updateItem(it.id, { unit: e.target.value })} /></td>
                  <td style={{ width: 100 }}><input type="number" className="sf-input" value={it.unitPrice} onChange={(e) => updateItem(it.id, { unitPrice: parseFloat(e.target.value) || 0 })} /></td>
                  <td style={{ width: 80 }}><input type="number" className="sf-input" value={it.discountPct} onChange={(e) => updateItem(it.id, { discountPct: parseFloat(e.target.value) || 0 })} /></td>
                  <td style={{ width: 90 }}>
                    <select className="sf-select" value={it.vatPct} onChange={(e) => updateItem(it.id, { vatPct: parseFloat(e.target.value) })}>
                      {VAT_RATES.map((v) => <option key={v} value={v}>{v}%</option>)}
                    </select>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{moneyPrecise(lineTotal)}</td>
                  <td><button onClick={() => removeItem(it.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#A23F32" }}><Trash2 size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        <div style={{ padding: 12 }}>
          <button className="sf-btn" onClick={addItem}><Plus size={14} />Add line item</button>
        </div>
      </Card>

      {!valid && <div style={{ fontSize: 12.5, color: "#A23F32", marginBottom: 10 }}>Select a client, add a subject, and at least one line item.</div>}

      <div className="sf-cols-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Deposit percentage">
          <input type="number" className="sf-input" value={form.depositPct} onChange={(e) => setForm((f) => ({ ...f, depositPct: parseFloat(e.target.value) || 0 }))} />
        </Field>
        <Card style={{ padding: 14 }}>
          <TotalRow label="Subtotal" value={moneyPrecise(totals.subtotal)} />
          <TotalRow label="VAT" value={moneyPrecise(totals.vat)} />
          <TotalRow label="Total" value={moneyPrecise(totals.total)} bold />
        </Card>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <button className="sf-btn" onClick={onCancel}>Cancel</button>
        <button className="sf-btn sf-btn-primary" disabled={!valid} style={{ opacity: valid ? 1 : 0.5 }} onClick={() => valid && onSave(form)}>Save quote</button>
      </div>
    </div>
  );
}

/* -------------------------------- projects ---------------------------------- */

function ProjectsPage({ data, setData, view, goto }) {
  const [filter, setFilter] = useState("All");
  const selected = view.id ? data.projects.find((p) => p.id === view.id) : null;
  const clientName = (id) => data.clients.find((c) => c.id === id)?.name || "Unknown client";

  const updateProject = (patch) => setData((d) => ({ ...d, projects: d.projects.map((p) => (p.id === selected.id ? { ...p, ...patch } : p)) }));

  if (selected) return <ProjectDetail project={selected} clientName={clientName(selected.clientId)} updateProject={updateProject} goto={goto} />;

  const filtered = data.projects.filter((p) => filter === "All" || p.status === filter);

  return (
    <div>
      <SectionTitle title="Projects" subtitle={`${data.projects.length} total`} />
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {["All", ...PROJECT_STATUSES].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className="sf-btn" style={{ background: filter === s ? "var(--ink)" : "#fff", color: filter === s ? "#fff" : "var(--text)", borderColor: filter === s ? "var(--ink)" : "var(--border-c)" }}>{s}</button>
        ))}
      </div>
      <div className="sf-cols-multi" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {filtered.map((p) => {
          const f = projectFinancials(p);
          const prog = taskProgress(p);
          return (
            <Card key={p.id} style={{ padding: 16, cursor: "pointer" }}>
              <div onClick={() => goto("projects", p.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{p.name}</div>
                  <Pill tone={statusTone[p.status]}>{p.status}</Pill>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>{clientName(p.clientId)} · {p.address}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 4, background: "#EEF0EF", overflow: "hidden" }}>
                    <div style={{ width: `${prog}%`, height: "100%", background: "var(--accent)" }} />
                  </div>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{prog}%</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span style={{ color: "var(--muted)" }}>Budget {money(f.budget)}</span>
                  <span style={{ color: f.margin >= 0 ? "#2E6E45" : "#A23F32", fontWeight: 600 }}>Margin {money(f.margin)}</span>
                </div>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <Card style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>No projects in this status.</Card>}
      </div>
    </div>
  );
}

const PROJECT_TABS = ["Overview", "Tasks", "Expenses", "Payments"];

function ProjectDetail({ project, clientName, updateProject, goto }) {
  const [tab, setTab] = useState("Overview");
  const f = projectFinancials(project);
  const prog = taskProgress(project);

  return (
    <div>
      <button className="sf-btn" style={{ marginBottom: 14 }} onClick={() => goto("projects")}>← Back to projects</button>
      <SectionTitle
        title={project.name}
        subtitle={`${clientName} · ${project.address}`}
        action={
          <select className="sf-select" value={project.status} onChange={(e) => updateProject({ status: e.target.value })}>
            {PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        }
      />
      <div className="sf-cols-multi" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 18 }}>
        <MiniStat label="Progress" value={`${prog}%`} />
        <MiniStat label="Budget" value={money(f.budget)} />
        <MiniStat label="Expenses" value={money(f.expensesTotal)} />
        <MiniStat label="Collected" value={money(f.collected)} />
        <MiniStat label="Margin" value={money(f.margin)} tone={f.margin >= 0 ? "green" : "red"} />
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border-c)" }}>
        {PROJECT_TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "9px 14px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13.5, fontWeight: 600,
            color: tab === t ? "var(--text)" : "var(--muted)", borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent", marginBottom: -1,
          }}>{t}</button>
        ))}
      </div>

      {tab === "Overview" && <ProjectOverview project={project} updateProject={updateProject} f={f} />}
      {tab === "Tasks" && <ProjectTasks project={project} updateProject={updateProject} />}
      {tab === "Expenses" && <ProjectExpenses project={project} updateProject={updateProject} f={f} />}
      {tab === "Payments" && <ProjectPayments project={project} updateProject={updateProject} f={f} />}
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  const color = tone === "green" ? "#2E6E45" : tone === "red" ? "#A23F32" : "var(--text)";
  return (
    <Card style={{ padding: 12 }}>
      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16.5, fontWeight: 700, color }}>{value}</div>
    </Card>
  );
}

function ProjectOverview({ project, updateProject, f }) {
  return (
    <div className="sf-cols-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <Card style={{ padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Schedule</div>
        <div className="sf-cols-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Start date"><input type="date" className="sf-input" value={project.startDate} onChange={(e) => updateProject({ startDate: e.target.value })} /></Field>
          <Field label="Target end date"><input type="date" className="sf-input" value={project.endDate} onChange={(e) => updateProject({ endDate: e.target.value })} /></Field>
        </div>
        <Field label="Project manager"><input className="sf-input" value={project.manager} onChange={(e) => updateProject({ manager: e.target.value })} placeholder="Assign a manager" /></Field>
        <Field label="Budget"><input type="number" className="sf-input" value={project.budget} onChange={(e) => updateProject({ budget: parseFloat(e.target.value) || 0 })} /></Field>
      </Card>
      <Card style={{ padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Budget vs actual</div>
        <BudgetBar label="Budgeted" value={f.budget} max={Math.max(f.budget, f.expensesTotal)} color="#B8C0C6" />
        <BudgetBar label="Spent" value={f.expensesTotal} max={Math.max(f.budget, f.expensesTotal)} color="#C9781F" />
        <div style={{ marginTop: 14 }}>
          <TotalRow label="Invoiced" value={money(f.invoiced)} />
          <TotalRow label="Collected" value={money(f.collected)} />
          <TotalRow label="Balance due" value={money(f.remaining)} bold />
          <TotalRow label="Estimated margin" value={money(f.margin)} bold />
        </div>
      </Card>
    </div>
  );
}
function BudgetBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
        <span style={{ color: "var(--muted)" }}>{label}</span>
        <span style={{ fontWeight: 600 }}>{money(value)}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: "#EEF0EF", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

function ProjectTasks({ project, updateProject }) {
  const [modal, setModal] = useState(null); // task or "new"
  const save = (task) => {
    const exists = project.tasks.some((t) => t.id === task.id);
    const tasks = exists ? project.tasks.map((t) => (t.id === task.id ? task : t)) : [...project.tasks, task];
    updateProject({ tasks });
    setModal(null);
  };
  const remove = (id) => updateProject({ tasks: project.tasks.filter((t) => t.id !== id) });
  const cycleStatus = (t) => {
    const idx = TASK_STATUSES.indexOf(t.status);
    const next = TASK_STATUSES[(idx + 1) % TASK_STATUSES.length];
    save({ ...t, status: next, progress: next === "Done" ? 100 : t.progress });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button className="sf-btn sf-btn-primary" onClick={() => setModal("new")}><Plus size={14} />Add task</button>
      </div>
      <Card style={{ padding: 0 }}>
        <div className="sf-table-wrap"><table className="sf-table">
          <thead><tr><th></th><th>Task</th><th>Assignee</th><th>Due</th><th>Priority</th><th>Progress</th><th></th></tr></thead>
          <tbody>
            {project.tasks.map((t) => (
              <tr key={t.id} className="sf-row-hover">
                <td style={{ width: 32 }}>
                  <button onClick={() => cycleStatus(t)} title="Cycle status" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }}>
                    {t.status === "Done" ? <CheckCircle2 size={17} color="#2E6E45" /> : t.status === "In progress" ? <Clock size={17} color="#93611A" /> : <Circle size={17} color="#B8C0C6" />}
                  </button>
                </td>
                <td style={{ fontWeight: 600, textDecoration: t.status === "Done" ? "line-through" : "none", color: t.status === "Done" ? "var(--muted)" : "var(--text)" }}>{t.title}</td>
                <td>{t.assignee || "Unassigned"}</td>
                <td>{fmtDate(t.dueDate)}</td>
                <td><Pill tone={statusTone[t.priority]}>{t.priority}</Pill></td>
                <td style={{ width: 120 }}>
                  <div style={{ height: 6, borderRadius: 4, background: "#EEF0EF", overflow: "hidden" }}>
                    <div style={{ width: `${t.status === "Done" ? 100 : t.progress}%`, height: "100%", background: "var(--accent)" }} />
                  </div>
                </td>
                <td style={{ width: 70 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setModal(t)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)" }}><Pencil size={13} /></button>
                    <button onClick={() => remove(t.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#A23F32" }}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {project.tasks.length === 0 && <tr><td colSpan={7}><EmptyRow text="No tasks yet." /></td></tr>}
          </tbody>
        </table></div>
      </Card>
      {modal && (
        <TaskModal
          task={modal === "new" ? { id: uid(), title: "", description: "", assignee: "", startDate: todayISO(), dueDate: todayISO(), priority: "Normal", status: "To do", progress: 0 } : modal}
          onClose={() => setModal(null)} onSave={save}
        />
      )}
    </div>
  );
}

function TaskModal({ task, onClose, onSave }) {
  const [form, setForm] = useState(task);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.title.trim().length > 0;
  return (
    <Modal title={task.title ? "Edit task" : "Add task"} onClose={onClose}>
      <Field label="Title"><input className="sf-input" value={form.title} onChange={set("title")} placeholder="Install cabinetry" /></Field>
      <Field label="Description"><textarea className="sf-textarea" rows={2} value={form.description} onChange={set("description")} /></Field>
      <Field label="Assignee"><input className="sf-input" value={form.assignee} onChange={set("assignee")} placeholder="Team member or subcontractor" /></Field>
      <div className="sf-cols-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Start date"><input type="date" className="sf-input" value={form.startDate} onChange={set("startDate")} /></Field>
        <Field label="Due date"><input type="date" className="sf-input" value={form.dueDate} onChange={set("dueDate")} /></Field>
        <Field label="Priority">
          <select className="sf-select" value={form.priority} onChange={set("priority")}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
        </Field>
        <Field label="Status">
          <select className="sf-select" value={form.status} onChange={set("status")}>{TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        </Field>
      </div>
      <Field label={`Progress (${form.progress}%)`}>
        <input type="range" min="0" max="100" step="5" value={form.progress} onChange={(e) => setForm((f) => ({ ...f, progress: parseInt(e.target.value) }))} style={{ width: "100%" }} />
      </Field>
      {!valid && <div style={{ fontSize: 12.5, color: "#A23F32", marginBottom: 10 }}>Enter a task title to save.</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
        <button className="sf-btn" onClick={onClose}>Cancel</button>
        <button className="sf-btn sf-btn-primary" disabled={!valid} style={{ opacity: valid ? 1 : 0.5 }} onClick={() => valid && onSave(form)}>Save task</button>
      </div>
    </Modal>
  );
}

function ProjectExpenses({ project, updateProject, f }) {
  const [modal, setModal] = useState(null);
  const save = (exp) => {
    const exists = project.expenses.some((e) => e.id === exp.id);
    const expenses = exists ? project.expenses.map((e) => (e.id === exp.id ? exp : e)) : [...project.expenses, exp];
    updateProject({ expenses });
    setModal(null);
  };
  const remove = (id) => updateProject({ expenses: project.expenses.filter((e) => e.id !== id) });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>Budget {money(f.budget)} · Spent {money(f.expensesTotal)} ({f.budget > 0 ? Math.round((f.expensesTotal / f.budget) * 100) : 0}%)</div>
        <button className="sf-btn sf-btn-primary" onClick={() => setModal("new")}><Plus size={14} />Add expense</button>
      </div>
      <Card style={{ padding: 0 }}>
        <div className="sf-table-wrap"><table className="sf-table">
          <thead><tr><th>Description</th><th>Category</th><th>Supplier</th><th>Date</th><th style={{ textAlign: "right" }}>Amount (incl. VAT)</th><th></th></tr></thead>
          <tbody>
            {project.expenses.map((e) => (
              <tr key={e.id} className="sf-row-hover">
                <td style={{ fontWeight: 600 }}>{e.description}</td>
                <td>{e.category}</td>
                <td>{e.supplier || "—"}</td>
                <td>{fmtDate(e.date)}</td>
                <td style={{ textAlign: "right" }}>{moneyPrecise(e.amountHT * (1 + e.vatPct / 100))}</td>
                <td style={{ width: 70 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setModal(e)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)" }}><Pencil size={13} /></button>
                    <button onClick={() => remove(e.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#A23F32" }}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {project.expenses.length === 0 && <tr><td colSpan={6}><EmptyRow text="No expenses recorded." /></td></tr>}
          </tbody>
        </table></div>
      </Card>
      {modal && (
        <ExpenseModal
          expense={modal === "new" ? { id: uid(), description: "", category: "Materials", amountHT: 0, vatPct: 10, date: todayISO(), supplier: "" } : modal}
          onClose={() => setModal(null)} onSave={save}
        />
      )}
    </div>
  );
}

function ExpenseModal({ expense, onClose, onSave }) {
  const [form, setForm] = useState(expense);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setNum = (k) => (e) => setForm((f) => ({ ...f, [k]: parseFloat(e.target.value) || 0 }));
  const valid = form.description.trim().length > 0 && form.amountHT > 0;
  return (
    <Modal title={expense.description ? "Edit expense" : "Add expense"} onClose={onClose}>
      <Field label="Description"><input className="sf-input" value={form.description} onChange={set("description")} placeholder="Cabinet order deposit" /></Field>
      <div className="sf-cols-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Category"><select className="sf-select" value={form.category} onChange={set("category")}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Supplier"><input className="sf-input" value={form.supplier} onChange={set("supplier")} /></Field>
        <Field label="Amount before VAT"><input type="number" className="sf-input" value={form.amountHT} onChange={setNum("amountHT")} /></Field>
        <Field label="VAT rate">
          <select className="sf-select" value={form.vatPct} onChange={(e) => setForm((f) => ({ ...f, vatPct: parseFloat(e.target.value) }))}>{VAT_RATES.map((v) => <option key={v} value={v}>{v}%</option>)}</select>
        </Field>
        <Field label="Date"><input type="date" className="sf-input" value={form.date} onChange={set("date")} /></Field>
      </div>
      {!valid && <div style={{ fontSize: 12.5, color: "#A23F32", marginBottom: 10 }}>Enter a description and an amount greater than zero.</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
        <button className="sf-btn" onClick={onClose}>Cancel</button>
        <button className="sf-btn sf-btn-primary" disabled={!valid} style={{ opacity: valid ? 1 : 0.5 }} onClick={() => valid && onSave(form)}>Save expense</button>
      </div>
    </Modal>
  );
}

function ProjectPayments({ project, updateProject, f }) {
  const [modal, setModal] = useState(null);
  const save = (pay) => {
    const exists = project.payments.some((p) => p.id === pay.id);
    const payments = exists ? project.payments.map((p) => (p.id === pay.id ? pay : p)) : [...project.payments, pay];
    updateProject({ payments });
    setModal(null);
  };
  const remove = (id) => updateProject({ payments: project.payments.filter((p) => p.id !== id) });
  const payStatus = f.remaining <= 0 ? "Paid" : f.collected > 0 ? "Partially paid" : "Pending";

  return (
    <div>
      <div className="sf-cols-multi" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
        <MiniStat label="Invoiced" value={money(f.invoiced)} />
        <MiniStat label="Collected" value={money(f.collected)} />
        <MiniStat label="Balance due" value={money(f.remaining)} tone={f.remaining > 0 ? "red" : "green"} />
        <MiniStat label="Status" value={payStatus} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Field label="Invoiced amount">
          <input type="number" className="sf-input" style={{ width: 160 }} value={project.invoicedAmount || 0} onChange={(e) => updateProject({ invoicedAmount: parseFloat(e.target.value) || 0 })} />
        </Field>
        <button className="sf-btn sf-btn-primary" onClick={() => setModal("new")}><Plus size={14} />Record payment</button>
      </div>
      <Card style={{ padding: 0 }}>
        <div className="sf-table-wrap"><table className="sf-table">
          <thead><tr><th>Date</th><th>Method</th><th>Note</th><th style={{ textAlign: "right" }}>Amount</th><th></th></tr></thead>
          <tbody>
            {project.payments.map((p) => (
              <tr key={p.id} className="sf-row-hover">
                <td>{fmtDate(p.date)}</td>
                <td>{p.method}</td>
                <td>{p.note || "—"}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{moneyPrecise(p.amount)}</td>
                <td style={{ width: 40 }}>
                  <button onClick={() => remove(p.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#A23F32" }}><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
            {project.payments.length === 0 && <tr><td colSpan={5}><EmptyRow text="No payments recorded." /></td></tr>}
          </tbody>
        </table></div>
      </Card>
      {modal && (
        <PaymentModal
          payment={modal === "new" ? { id: uid(), amount: 0, date: todayISO(), method: "Bank transfer", note: "" } : modal}
          onClose={() => setModal(null)} onSave={save}
        />
      )}
    </div>
  );
}

function PaymentModal({ payment, onClose, onSave }) {
  const [form, setForm] = useState(payment);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.amount > 0;
  return (
    <Modal title="Record payment" onClose={onClose}>
      <div className="sf-cols-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Amount"><input type="number" className="sf-input" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} /></Field>
        <Field label="Date"><input type="date" className="sf-input" value={form.date} onChange={set("date")} /></Field>
      </div>
      <Field label="Method">
        <select className="sf-select" value={form.method} onChange={set("method")}>
          {["Bank transfer", "Check", "Credit card", "Cash"].map((m) => <option key={m}>{m}</option>)}
        </select>
      </Field>
      <Field label="Note"><input className="sf-input" value={form.note} onChange={set("note")} placeholder="Deposit, progress payment…" /></Field>
      {!valid && <div style={{ fontSize: 12.5, color: "#A23F32", marginBottom: 10 }}>Enter an amount greater than zero.</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
        <button className="sf-btn" onClick={onClose}>Cancel</button>
        <button className="sf-btn sf-btn-primary" disabled={!valid} style={{ opacity: valid ? 1 : 0.5 }} onClick={() => valid && onSave(form)}>Save payment</button>
      </div>
    </Modal>
  );
}
