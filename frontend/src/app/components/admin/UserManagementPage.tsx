import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Shield, Search, X } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, Btn, DataTable } from "../shared/UI";
import { toast } from "sonner";
import {
  getUsers, createUser, updateUserRole, toggleUserActive, getRoles,
  type UserDto, type RoleDto,
} from "../../../lib/services/users.service";
import { getAuditLogs } from "../../../lib/services/audit.service";

interface User {
  id: string; name: string; email: string; role: string; dept: string;
  joined: string; lastLogin: string; status: string;
  _apiId?: number; _roleId?: number;
}

const initialUsers: User[] = [
  { id: "USR-001", name: "Vikram Sharma", email: "vikram@dvsindustries.com", role: "admin", dept: "Management", joined: "01 Jan 2020", lastLogin: "12 Jun 09:22", status: "active" },
  { id: "USR-002", name: "Priya Kapoor", email: "priya@dvsindustries.com", role: "admin", dept: "Operations", joined: "15 Mar 2021", lastLogin: "12 Jun 08:45", status: "active" },
  { id: "USR-003", name: "SteelCorp Ltd.", email: "orders@steelcorp.com", role: "supplier", dept: "Steel", joined: "20 Jun 2022", lastLogin: "11 Jun 15:30", status: "active" },
  { id: "USR-004", name: "AluminCo Pvt.", email: "supply@aluminco.com", role: "supplier", dept: "Aluminium", joined: "08 Aug 2022", lastLogin: "10 Jun 11:00", status: "active" },
  { id: "USR-005", name: "Reliance Eng.", email: "orders@reliance-eng.com", role: "client", dept: "Automotive", joined: "10 Feb 2023", lastLogin: "12 Jun 07:30", status: "active" },
  { id: "USR-006", name: "Tata Motors", email: "procurement@tatamotors.com", role: "client", dept: "Automotive", joined: "05 Mar 2023", lastLogin: "11 Jun 14:20", status: "active" },
  { id: "USR-007", name: "Rajan Iyer", email: "rajan@dvsindustries.com", role: "admin", dept: "Security", joined: "11 Nov 2021", lastLogin: "09 Jun 16:00", status: "inactive" },
];

const roleColors: Record<string, string> = { admin: "#A52A2A", supplier: "#2E7D32", client: "#1565C0" };

const permissions = [
  { role: "Admin", perms: ["Full system access", "User management", "Security monitoring", "Reports generation", "Order management", "Settings control"] },
  { role: "Supplier", perms: ["Material catalog management", "Purchase order management", "Delivery tracking", "Invoice upload", "Performance view", "Communication"] },
  { role: "Client", perms: ["Product catalog browse", "Order placement", "Order tracking", "Invoice access", "Support ticket", "Delivery confirmation"] },
];

const departments = ["Management", "Operations", "Security", "Production", "Quality", "Inventory", "Finance", "Steel", "Aluminium", "Copper", "Automotive", "Engineering"];

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className="rounded-xl overflow-hidden w-full max-w-md mx-4" style={{ background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #E8E2E0", background: "#F9F6F5" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#7A6C6A" }}><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #E8E2E0", borderRadius: "0.4rem", fontSize: "0.8375rem", outline: "none", background: "#fff" };
const labelStyle: React.CSSProperties = { fontSize: "0.72rem", fontWeight: 600, color: "#4E342E", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "0.3rem" };

export function UserManagementPage() {
  const [activeTab, setActiveTab]   = useState<"users" | "permissions" | "logs">("users");
  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [users, setUsers]           = useState<User[]>(initialUsers);
  const [roles, setRoles]           = useState<RoleDto[]>([]);
  const [auditLogs, setAuditLogs]   = useState<Array<{ time: string; user: string; action: string; type: string }>>([]);
  const [showAdd, setShowAdd]       = useState(false);
  const [editUser, setEditUser]     = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [newUser, setNewUser]       = useState({ name: "", email: "", password: "", role: "admin", roleId: 1, dept: "Management", status: "active" });

  // ── Load from API ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getUsers({ pageSize: 100 }).catch(() => null),
      getRoles().catch(() => null),
      getAuditLogs({ pageSize: 20, sortOrder: "desc" }).catch(() => null),
    ]).then(([userRes, roleRes, logRes]) => {
      if (cancelled) return;
      if (userRes && userRes.data.length > 0) {
        setUsers(userRes.data.map(u => ({
          id: `USR-${String(u.id).padStart(3, "0")}`,
          name: u.fullName,
          email: u.email,
          role: u.role.name.toLowerCase(),
          dept: u.employee?.employeeCode ?? "System",
          joined: new Date(u.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
          lastLogin: u.lastLogin ? new Date(u.lastLogin).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never",
          status: u.isActive ? "active" : "inactive",
          _apiId: u.id,
          _roleId: u.roleId,
        })));
      }
      if (roleRes && roleRes.length > 0) setRoles(roleRes);
      if (logRes && logRes.data.length > 0) {
        setAuditLogs(logRes.data.map(l => ({
          time: new Date(l.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
          user: l.userEmail ?? "System",
          action: `${l.action} ${l.entity}${l.entityId ? ` #${l.entityId}` : ""} ${l.path ?? ""}`.trim(),
          type: l.action === "LOGIN" ? "info" : l.action === "DELETE" ? "critical" : l.statusCode && l.statusCode >= 400 ? "warn" : "info",
        })));
      }
    });
    return () => { cancelled = true; };
  }, []);

  const nextId = () => `USR-${String(users.length + 1).padStart(3, "0")}`;

  const handleAdd = async () => {
    if (!newUser.name.trim() || !newUser.email.trim()) { toast.error("Please fill all required fields"); return; }
    try {
      const roleObj = roles.find(r => r.name.toLowerCase() === newUser.role) ?? roles[0];
      const created = await createUser({ fullName: newUser.name, email: newUser.email, password: newUser.password || "Temp@1234", roleId: roleObj?.id ?? 1 });
      const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(",", "");
      setUsers(prev => [...prev, { id: nextId(), name: created.fullName, email: created.email, role: created.role.name.toLowerCase(), dept: newUser.dept, joined: today, lastLogin: "Never", status: "active", _apiId: created.id }]);
      toast.success("User added successfully");
    } catch {
      const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(",", "");
      setUsers(prev => [...prev, { id: nextId(), ...newUser, joined: today, lastLogin: "Never" }]);
      toast.success("User added (offline mode)");
    }
    setNewUser({ name: "", email: "", password: "", role: "admin", roleId: 1, dept: "Management", status: "active" });
    setShowAdd(false);
  };

  const handleEdit = async () => {
    if (!editUser) return;
    try {
      if (editUser._apiId) {
        const roleObj = roles.find(r => r.name.toLowerCase() === editUser.role);
        if (roleObj) await updateUserRole(editUser._apiId, roleObj.id);
        if (editUser.status === "inactive") await toggleUserActive(editUser._apiId);
      }
    } catch { /* update locally */ }
    setUsers(prev => prev.map(u => u.id === editUser.id ? editUser : u));
    setEditUser(null);
    toast.success("User updated successfully");
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    try {
      if (deleteUser._apiId) await toggleUserActive(deleteUser._apiId); // deactivate instead of hard delete
    } catch { /* remove locally */ }
    setUsers(prev => prev.filter(u => u.id !== deleteUser.id));
    setDeleteUser(null);
    toast.success("User removed successfully");
  };

  const filtered = users.filter(
    u => (roleFilter === "all" || u.role === roleFilter) && (u.name.toLowerCase().includes(search.toLowerCase()) || u.email.includes(search))
  );

  return (
    <>
    {showAdd && (
      <Modal title="Add New User" onClose={() => setShowAdd(false)}>
        <div className="space-y-4">
          <div><label style={labelStyle}>Full Name</label><input style={fieldStyle} value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="e.g. Arjun Mehta" /></div>
          <div><label style={labelStyle}>Email Address</label><input style={fieldStyle} type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="arjun@dvsindustries.com" /></div>
          <div><label style={labelStyle}>Password</label><input style={fieldStyle} type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Min 8 characters" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Role</label>
              <select style={fieldStyle} value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                {roles.length > 0
                  ? roles.map(r => <option key={r.id} value={r.name.toLowerCase()}>{r.name}</option>)
                  : ["admin","supplier","client"].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)
                }
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={fieldStyle} value={newUser.status} onChange={(e) => setNewUser({ ...newUser, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Department</label>
            <select style={fieldStyle} value={newUser.dept} onChange={(e) => setNewUser({ ...newUser, dept: e.target.value })}>
              {departments.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: "0.6rem", border: "1px solid #E8E2E0", borderRadius: "0.5rem", background: "#fff", cursor: "pointer" }}>Cancel</button>
            <button onClick={handleAdd} style={{ flex: 2, padding: "0.6rem", border: "none", borderRadius: "0.5rem", background: "#A52A2A", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Add User</button>
          </div>
        </div>
      </Modal>
    )}

    {editUser && (
      <Modal title={`Edit User — ${editUser.id}`} onClose={() => setEditUser(null)}>
        <div className="space-y-4">
          <div><label style={labelStyle}>Full Name</label><input style={fieldStyle} value={editUser.name} onChange={(e) => setEditUser({ ...editUser, name: e.target.value })} /></div>
          <div><label style={labelStyle}>Email Address</label><input style={fieldStyle} value={editUser.email} onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Role</label>
              <select style={fieldStyle} value={editUser.role} onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}>
                <option value="admin">Admin</option>
                <option value="supplier">Supplier</option>
                <option value="client">Client</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={fieldStyle} value={editUser.status} onChange={(e) => setEditUser({ ...editUser, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Department</label>
            <select style={fieldStyle} value={editUser.dept} onChange={(e) => setEditUser({ ...editUser, dept: e.target.value })}>
              {departments.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setEditUser(null)} style={{ flex: 1, padding: "0.6rem", border: "1px solid #E8E2E0", borderRadius: "0.5rem", background: "#fff", cursor: "pointer" }}>Cancel</button>
            <button onClick={handleEdit} style={{ flex: 2, padding: "0.6rem", border: "none", borderRadius: "0.5rem", background: "#4E342E", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Save Changes</button>
          </div>
        </div>
      </Modal>
    )}

    {deleteUser && (
      <Modal title="Confirm Delete" onClose={() => setDeleteUser(null)}>
        <div>
          <div className="p-4 rounded-lg mb-4" style={{ background: "#FFEBEE", border: "1px solid #FFCDD2" }}>
            <p style={{ fontSize: "0.875rem", color: "#C0392B", fontWeight: 600, marginBottom: "0.25rem" }}>Warning: This action cannot be undone</p>
            <p style={{ fontSize: "0.8rem", color: "#7A6C6A" }}>Removing <strong>{deleteUser.name}</strong> ({deleteUser.id}) will revoke all their system access.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setDeleteUser(null)} style={{ flex: 1, padding: "0.6rem", border: "1px solid #E8E2E0", borderRadius: "0.5rem", background: "#fff", cursor: "pointer" }}>Cancel</button>
            <button onClick={handleDelete} style={{ flex: 1, padding: "0.6rem", border: "none", borderRadius: "0.5rem", background: "#C0392B", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Delete User</button>
          </div>
        </div>
      </Modal>
    )}

    <div className="p-6">
      <PageHeader
        title="User Management"
        subtitle="Manage admin, supplier, and client accounts with role-based access control"
        actions={<Btn size="sm" onClick={() => setShowAdd(true)}><Plus size={14} /> Add User</Btn>}
      />

      <div className="flex gap-0 mb-5" style={{ borderBottom: "2px solid #E8E2E0" }}>
        {[["users", "All Users"], ["permissions", "Permissions"], ["logs", "Audit Logs"]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            style={{
              padding: "0.625rem 1rem", fontSize: "0.8375rem",
              fontWeight: activeTab === id ? 600 : 400,
              color: activeTab === id ? "#A52A2A" : "#7A6C6A",
              borderBottom: `2px solid ${activeTab === id ? "#A52A2A" : "transparent"}`,
              marginBottom: "-2px", background: "transparent", border: "none", cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "users" && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2 flex-1 min-w-48 px-3 py-2 rounded-md" style={{ background: "#fff", border: "1px solid #E8E2E0" }}>
              <Search size={14} color="#9A8A88" />
              <input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: "0.8375rem", flex: 1, background: "transparent" }}
              />
            </div>
            <div className="flex gap-1">
              {["all", "admin", "supplier", "client"].map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  style={{
                    padding: "0.375rem 0.75rem", borderRadius: "0.35rem", fontSize: "0.775rem",
                    background: roleFilter === r ? "#A52A2A" : "#fff", color: roleFilter === r ? "#fff" : "#4A4A4A",
                    border: `1px solid ${roleFilter === r ? "#A52A2A" : "#E8E2E0"}`, cursor: "pointer", textTransform: "capitalize",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <Card>
            <DataTable
              searchable
              paginate={10}
              exportFilename="DVS_Users.csv"
              columns={[
                { key: "id", label: "User ID" },
                { key: "name", label: "Name / Email" },
                { key: "role", label: "Role" },
                { key: "dept", label: "Department" },
                { key: "joined", label: "Joined" },
                { key: "lastLogin", label: "Last Login" },
                { key: "status", label: "Status" },
                { key: "actions", label: "Actions" },
              ]}
              rows={filtered.map((u) => ({
                id: <span style={{ fontSize: "0.72rem", fontFamily: "JetBrains Mono, monospace", color: "#7A6C6A" }}>{u.id}</span>,
                name: (
                  <div>
                    <p style={{ fontWeight: 600, fontSize: "0.8375rem" }}>{u.name}</p>
                    <p style={{ fontSize: "0.72rem", color: "#9A8A88" }}>{u.email}</p>
                  </div>
                ),
                role: (
                  <span className="px-2.5 py-1 rounded-full" style={{ fontSize: "0.72rem", fontWeight: 600, background: `${roleColors[u.role]}12`, color: roleColors[u.role], textTransform: "capitalize" }}>
                    {u.role}
                  </span>
                ),
                dept: u.dept,
                joined: u.joined,
                lastLogin: <span style={{ fontSize: "0.775rem" }}>{u.lastLogin}</span>,
                status: <StatusBadge status={u.status} />,
                actions: (
                  <div className="flex gap-1.5">
                    <button onClick={() => setEditUser({ ...u })} className="p-1.5 rounded" style={{ background: "#F5F0EF", color: "#4E342E", cursor: "pointer", border: "none" }}><Edit2 size={12} /></button>
                    <button onClick={() => setDeleteUser(u)} className="p-1.5 rounded" style={{ background: "#FFEBEE", color: "#C0392B", cursor: "pointer", border: "none" }}><Trash2 size={12} /></button>
                  </div>
                ),
              }))}
            />
          </Card>
        </div>
      )}

      {activeTab === "permissions" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {permissions.map((p) => (
            <Card key={p.role}>
              <CardHeader
                title={`${p.role} Permissions`}
                actions={
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${roleColors[p.role.toLowerCase()]}12` }}>
                    <Shield size={14} color={roleColors[p.role.toLowerCase()]} />
                  </div>
                }
              />
              <div className="p-5">
                {p.perms.map((perm) => (
                  <div key={perm} className="flex items-center gap-2 mb-2.5">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: roleColors[p.role.toLowerCase()] }} />
                    <span style={{ fontSize: "0.8375rem", color: "#4A4A4A" }}>{perm}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "logs" && (
        <Card>
          <CardHeader title="Audit Logs" subtitle="Recent system activity" />
          <div>
            {(auditLogs.length > 0 ? auditLogs : [
              { time: "09:22", user: "Vikram Sharma", action: "Generated Production Report", type: "info" },
              { time: "09:14", user: "Security System", action: "Alert INC-2841 created — PPE Violation Zone B", type: "warn" },
              { time: "08:47", user: "Security System", action: "Alert INC-2840 created — Unauthorized Entry Gate 3", type: "critical" },
              { time: "08:30", user: "Vikram Sharma", action: "Approved PO-2847 — SteelCorp Ltd.", type: "info" },
              { time: "07:55", user: "Priya Kapoor", action: "Added worker EMP-047 — Ravi Nair, Welding dept", type: "info" },
              { time: "07:30", user: "System", action: "Inventory alert — Steel Tube 4mm out of stock", type: "warn" },
            ]).map((log, i) => (
              <div key={i} className="flex items-start gap-4 px-5 py-3.5" style={{ borderBottom: "1px solid #F7F3F2" }}>
                <span style={{ fontSize: "0.72rem", fontFamily: "JetBrains Mono, monospace", color: "#9A8A88", minWidth: "40px" }}>{log.time}</span>
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: log.type === "critical" ? "#C0392B" : log.type === "warn" ? "#E65100" : "#2E7D32" }} />
                <div>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{log.user}</p>
                  <p style={{ fontSize: "0.775rem", color: "#7A6C6A" }}>{log.action}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
    </>
  );
}
