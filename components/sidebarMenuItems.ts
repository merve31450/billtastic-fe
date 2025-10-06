/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import type { MenuProps } from "antd";
import {
  DashboardOutlined,
  UserOutlined,
  HomeOutlined,
} from "@ant-design/icons";

type MenuItem = Required<MenuProps>["items"][number];
type Role = "admin" | "user" | "expert" | "guest";

/** Divider yardımcı */
const D = (): MenuItem => ({ type: "divider" } as MenuItem);

/** Tüm item’lar (roles tanımıyla) */
const allItems: (MenuItem & { roles?: Role[] })[] = [
  // ⛔ Panel: sadece admin görsün
  { key: "/configure", icon: React.createElement(DashboardOutlined), label: "E-Posta Yapılandırması" },

  { key: "/calculate", icon: React.createElement(HomeOutlined), label: "Test" },
  { key: "/reports", icon: React.createElement(UserOutlined), label: "Test 2" },
  
];

/** Bölümleme: ilk iki, orta kısım, son iki — senin yapına sadık */
const sliceIntoSections = (items: (MenuItem & { roles?: Role[] })[]) => {
  const first = items.slice(0, 3);
  const middle = items.slice(2, -2);
  const last = items.slice(-2);
  return { first, middle, last };
};

/** Divider’ları normalize et: baş/sonda olmasın, ardışık olmasın */
const normalizeDividers = (items: MenuItem[]): MenuItem[] => {
  const out: MenuItem[] = [];
  for (const it of items) {
    const isDivider = "type" in (it || {}) && (it as any).type === "divider";
    const prevIsDivider =
      out.length > 0 &&
      "type" in (out[out.length - 1] || {}) &&
      (out[out.length - 1] as any).type === "divider";

    if (isDivider && (prevIsDivider || out.length === 0)) continue; // başta veya üst üste divider olmasın
    out.push(it);
  }
  // sonda divider varsa at
  while (out.length && "type" in (out[out.length - 1] || {}) && (out[out.length - 1] as any).type === "divider") {
    out.pop();
  }
  return out;
};

/** Role’e göre filtrele + sections arası divider ekle + normalize et */
export const getMenuItemsByRole = (roleRaw?: string): MenuItem[] => {
  const role = (roleRaw || "user").toLowerCase() as Role;

  const visible = allItems.filter((it) => {
    if ("type" in (it as any)) return true; // güvenlik: divider’ı bloklamıyoruz (zaten normalize edeceğiz)
    if (!("roles" in it) || !it.roles || it.roles.length === 0) return true; // rol belirtilmemişse herkese açık
    return it.roles.map((r) => r.toLowerCase()).includes(role);
  });

  const { first, middle, last } = sliceIntoSections(visible as any);

  const stitched: MenuItem[] = [
    ...first,
    ...(first.length && middle.length ? [D()] : []),
    ...middle,
  ];

  return normalizeDividers(stitched);
};
