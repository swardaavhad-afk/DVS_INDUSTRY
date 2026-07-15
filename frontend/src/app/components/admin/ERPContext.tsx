import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface PODraft {
  materialName: string;
  materialId: string;
  currentStock: number;
  unit: string;
  reorderQty: number;
  unitCost: number;
  preferredSupplier: string;
}

export interface ERPNotification {
  id: string;
  msg: string;
  type: "info" | "success" | "warn" | "critical";
  time: string;
  read: boolean;
}

interface ERPCtx {
  pendingPO: PODraft | null;
  setPendingPO: (po: PODraft | null) => void;
  notifications: ERPNotification[];
  addNotification: (msg: string, type?: ERPNotification["type"]) => void;
  markAllRead: () => void;
  unreadCount: number;
}

const ERPContext = createContext<ERPCtx>({
  pendingPO: null,
  setPendingPO: () => {},
  notifications: [],
  addNotification: () => {},
  markAllRead: () => {},
  unreadCount: 0,
});

const SEED_NOTIFICATIONS: ERPNotification[] = [
  { id: "n1", msg: "Security alert ALT-002 unresolved — Unauthorized Entry at Gate 3", type: "critical", time: "09:14", read: false },
  { id: "n2", msg: "Steel Sheet inventory below threshold — 42 kg remaining (min 100 kg)", type: "warn", time: "08:30", read: false },
  { id: "n3", msg: "SteelCorp PO-2847 delivery confirmed for today 14:00", type: "success", time: "08:15", read: false },
  { id: "n4", msg: "Morning shift productivity 11% below target — 3 consecutive days", type: "warn", time: "07:45", read: true },
  { id: "n5", msg: "New client order ORD-2847 received from Maruti Suzuki", type: "info", time: "07:30", read: true },
  { id: "n6", msg: "Cutting Dept scrap rate at 8.2% — above target by 4.1%", type: "warn", time: "07:00", read: true },
];

export function ERPProvider({ children }: { children: ReactNode }) {
  const [pendingPO, setPendingPO] = useState<PODraft | null>(null);
  const [notifications, setNotifications] = useState<ERPNotification[]>(SEED_NOTIFICATIONS);

  const addNotification = useCallback((msg: string, type: ERPNotification["type"] = "info") => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    setNotifications((prev) => [{ id: `n${Date.now()}`, msg, type, time, read: false }, ...prev]);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <ERPContext.Provider value={{ pendingPO, setPendingPO, notifications, addNotification, markAllRead, unreadCount }}>
      {children}
    </ERPContext.Provider>
  );
}

export function useERP() {
  return useContext(ERPContext);
}
