import { useState } from "react";
import { Toaster } from "sonner";
import { HomePage } from "./components/HomePage";
import { LoginPage } from "./components/LoginPage";
import { AdminApp } from "./components/admin/AdminApp";
import { SupplierApp } from "./components/supplier/SupplierApp";
import { ClientApp } from "./components/client/ClientApp";
import { logout as apiLogout } from "../lib/auth";
import type { FrontendRole } from "../lib/auth";

type Page = "home" | "login" | FrontendRole;
type Role = "admin" | "supplier" | "client" | "production" | "quality" | "store";

export default function App() {
  const [page, setPage]           = useState<Page>("home");
  const [loginRole, setLoginRole] = useState<Role>("admin");

  const goToLogin = (role: Role = "admin") => {
    setLoginRole(role);
    setPage("login");
  };

  const handleLoginSuccess = (role: FrontendRole) => {
    setPage(role);
  };

  const handleLogout = async () => {
    await apiLogout();
    setPage("home");
  };

  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      {page === "home" && <HomePage onNavigateToLogin={goToLogin} />}
      {page === "login" && (
        <LoginPage
          initialRole={loginRole}
          onNavigateHome={() => setPage("home")}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
      {page === "admin"      && <AdminApp onLogout={handleLogout} userRole="admin" />}
      {page === "production" && <AdminApp onLogout={handleLogout} userRole="production" />}
      {page === "quality"    && <AdminApp onLogout={handleLogout} userRole="quality" />}
      {page === "store"      && <AdminApp onLogout={handleLogout} userRole="store" />}
      {page === "supplier"   && <SupplierApp onLogout={handleLogout} />}
      {page === "client"     && <ClientApp  onLogout={handleLogout} />}
    </>
  );
}
