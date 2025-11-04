/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import type { MenuProps } from "antd";
import {
  DashboardOutlined,
  HomeOutlined,
  UserOutlined,
  CalendarOutlined,
  SendOutlined,
  CreditCardOutlined,
  CheckSquareOutlined, // 🧩 Görevlerim ikonu
} from "@ant-design/icons";

/* ==============================
   TİPLER ve ROLLER
============================== */
type MenuItem = Required<MenuProps>["items"][number];
type Role = "admin" | "user" | "expert" | "guest";

/* ==============================
   🔹 Divider yardımcı fonksiyonu
============================== */
const D = (): MenuItem => ({ type: "divider" } as MenuItem);

/* ==============================
    TÜM MENÜLER
============================== */
const allItems: (MenuItem & { roles?: Role[] })[] = [
  { key: "/panel", icon: React.createElement(DashboardOutlined), label: "Ana Sayfa" },
  { key: "/configure", icon: React.createElement(HomeOutlined), label: "Faturalandırma" },
  { key: "/customers", icon: React.createElement(UserOutlined), label: "Müşteri Listesi" },
  { key: "/calendar", icon: React.createElement(CalendarOutlined), label: "Takvim" },
  { key: "/send", icon: React.createElement(SendOutlined), label: "E-Posta Gönder" },
  { key: "/payment/details", icon: React.createElement(CreditCardOutlined), label: "Ödeme Detayları" },




  { key: "/tasks", icon: React.createElement(CheckSquareOutlined), label: "Görevlerim" },
];

/* ==============================
    Divider temizleyici
============================== */
const normalizeDividers = (items: MenuItem[]): MenuItem[] => {
  const out: MenuItem[] = [];
  for (const it of items) {
    const isDivider = "type" in (it || {}) && (it as any).type === "divider";
    const prevIsDivider =
      out.length > 0 &&
      "type" in (out[out.length - 1] || {}) &&
      (out[out.length - 1] as any).type === "divider";

    // üst üste veya baştaki divider'ları atla
    if (isDivider && (prevIsDivider || out.length === 0)) continue;
    out.push(it);
  }
  // sondaki divider'ı da kaldır
  while (
    out.length &&
    "type" in (out[out.length - 1] || {}) &&
    (out[out.length - 1] as any).type === "divider"
  ) {
    out.pop();
  }
  return out;
};

/* ==============================
    Role göre filtreleme fonksiyonu
============================== */
export const getMenuItemsByRole = (roleRaw?: string): MenuItem[] => {
  const role = (roleRaw || "user").toLowerCase() as Role;

  // Rol bazlı filtre
  const visible = allItems.filter((it) => {
    if ("type" in (it as any)) return true; // divider’ı engelleme
    if (!("roles" in it) || !it.roles || it.roles.length === 0) return true; // herkese açık
    return it.roles.map((r) => r.toLowerCase()).includes(role);
  });

  // Divider'ları düzenle
  return normalizeDividers(visible);
};
