/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { Layout, Menu, Button, Grid, Drawer, Avatar, Dropdown } from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MenuOutlined,
  CloseOutlined,
  UserOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { getMenuItemsByRole } from "./sidebarMenuItems";
import { api } from "@/lib/api";

const { Sider, Content, Footer } = Layout;

const SIDEBAR_WIDTH = 264;
const SIDEBAR_COLLAPSED_WIDTH = 100;

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "/";
const staticUrl = (p: string) => `${BASE_PATH}/${p}`.replace(/\/{2,}/g, "/");

type Props = { children: React.ReactNode };

function base64ToDataUrl(b64?: string) {
  if (!b64) return undefined;
  if (b64.startsWith("data:")) return b64;
  const head = b64.slice(0, 16);
  const mime =
    head.startsWith("PHN2Zy") ? "image/svg+xml" :
    head.startsWith("iVBORw0KGgo") ? "image/png" :
    head.startsWith("/9j/") ? "image/jpeg" :
    head.startsWith("UklGR") ? "image/webp" : "image/*";
  return `data:${mime};base64,${b64}`;
}

function initialsFrom(me: any) {
  const name = (me?.firstName && me?.lastName)
    ? `${me.firstName} ${me.lastName}`
    : (me?.username || me?.email || "").split("@")[0];
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || "").toUpperCase() + (parts[1]?.[0] || "").toUpperCase();
}

function SidebarHeader({
  collapsed,
  isDesktop,
  onToggleCollapse,
  onCloseDrawer,
}: {
  collapsed: boolean;
  isDesktop: boolean;
  onToggleCollapse: () => void;
  onCloseDrawer?: () => void;
}) {
  const router = useRouter();

  const logoBoxWidth = collapsed ? 45 : 125;
  const logoBoxHeight = collapsed ? 40 : 90;

  const handleLogoClick = React.useCallback(() => {
    router.push("/panel");
    onCloseDrawer?.(); // mobilde drawer açıksa kapat
  }, [router, onCloseDrawer]);

  return (
    <div
      style={{
        background: "#0e2f71ff",
        display: "flex",
        alignItems: "center",
        minHeight: "4rem",
        maxHeight: "4rem",
        justifyContent: "space-between",
        paddingInline: 12,
      }}
    >
      {/* LOGO */}
      <div
        role="button"
        aria-label="Modüller sayfasına git"
        tabIndex={0}
        onClick={handleLogoClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleLogoClick();
          }
        }}
        className="relative overflow-hidden cursor-pointer select-none"
        style={{
          width: logoBoxWidth,
          height: logoBoxHeight,
          transition: "width 220ms ease, height 220ms ease",
          marginLeft: "2.6rem",
        }}
      >
        <Image
          src={staticUrl("Logo-1.png")}
          alt="Billtastic Logo"
          fill
          priority
          unoptimized
          style={{ objectFit: "contain" }}
          className={`absolute inset-0 transition-opacity duration-200 ease-out ${
            collapsed ? "opacity-0" : "opacity-100"
          }`}
        />
        <Image
          src={staticUrl("")}
          alt="Portal Logo (Küçük)"
          fill
          priority
          unoptimized
          style={{ objectFit: "contain" }}
          className={`absolute inset-0 transition-opacity duration-200 ease-out ${
            collapsed ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      <div>
        {isDesktop ? (
          <Button
            type="text"
            shape="circle"
            aria-label={collapsed ? "Menüyü aç" : "Menüyü daralt"}
            aria-expanded={!collapsed}
            className="!text-white hover:!bg-white/10 transition-colors duration-150"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={onToggleCollapse}
          />
        ) : (
          <Button
            type="text"
            shape="circle"
            aria-label="Menüyü kapat"
            className="!text-white hover:!bg-white/10 transition-colors duration-150"
            icon={<CloseOutlined />}
            onClick={onCloseDrawer}
          />
        )}
      </div>
    </div>
  );
}

export default function AppShell({ children }: Props) {
  const screens = Grid.useBreakpoint();
  const isDesktop = !!screens.lg;
  const router = useRouter();
  const pathname = usePathname() || "/";

  const [collapsed, setCollapsed] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const [me, setMe] = React.useState<any>(null);
  const [avatarSrc, setAvatarSrc] = React.useState<string | undefined>();
  const [companyName, setCompanyName] = React.useState<string>("");

  const [role, setRole] = React.useState<"admin" | "user" | "expert" | "guest">("user");
  const roleResolved = !!role;

  //  Kullanıcı bilgilerini çek
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem("meCache");
        if (raw) {
          const cached = JSON.parse(raw);
          setMe(cached);
          setCompanyName(cached?.companyName || "");
          setAvatarSrc(base64ToDataUrl(cached?.profileImage));
          const r = (cached?.role || cached?.roles?.[0] || "user").toLowerCase();
          setRole(["admin", "expert", "user"].includes(r) ? (r as any) : "user");
        }
      } catch {}
    }

    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/users/me");

        if (!mounted) return;
        setMe(data);
        setCompanyName(data?.companyName || data?.firmTitle || "");
        setAvatarSrc(base64ToDataUrl(data?.profileImage));

        const r = (data?.role || data?.roles?.[0] || "user").toLowerCase();
        setRole(["admin", "expert", "user"].includes(r) ? (r as any) : "user");

      
        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            "meCache",
            JSON.stringify({
              companyName: data?.companyName ?? data?.firmTitle ?? "",
              profileImage: data?.profileImage ?? null,
              firstName: data?.firstName ?? "",
              lastName: data?.lastName ?? "",
              username: data?.username ?? "",
              role: data?.role ?? null,
              roles: data?.roles ?? null,
            })
          );
        }
      } catch {
        // oturum yoksa sessiz
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Role göre yönlendirme
  React.useEffect(() => {
    if (!roleResolved) return;
    if (pathname === "/panel" && role !== "admin") {
      router.replace("/panel");
    }
  }, [pathname, roleResolved, role, router]);

  const SidebarMenu = (
    <Menu
      theme="light"
      mode="inline"
      selectedKeys={[pathname]}
      items={getMenuItemsByRole(role)}
      onClick={({ key }) => {
        router.push(String(key));
        if (!isDesktop) setDrawerOpen(false);
      }}
      style={{ borderInlineEnd: "none", paddingInline: 8 }}
    />
  );

  return (
    <Layout style={{ minHeight: "100dvh" }}>
      {/* DESKTOP SIDEBAR */}
      {isDesktop && (
        <Sider
          theme="light"
          width={SIDEBAR_WIDTH}
          collapsedWidth={SIDEBAR_COLLAPSED_WIDTH}
          collapsed={collapsed}
          trigger={null}
          className="bg-white !sticky top-0 h-[100dvh]"
          style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
        >
          <div className="sticky top-0 z-30 shadow-sm">
            <SidebarHeader
              collapsed={collapsed}
              isDesktop={isDesktop}
              onToggleCollapse={() => setCollapsed((v) => !v)}
            />
          </div>
          <div className="flex-1 overflow-auto">{SidebarMenu}</div>
        </Sider>
      )}

      {/* MOBILE DRAWER */}
      {!isDesktop && (
        <Drawer
          placement="left"
          width={SIDEBAR_WIDTH}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          closable={false}
          styles={{ header: { display: "none" }, body: { padding: 0 } }}
        >
          <div className="bg-white h-[100dvh] flex flex-col">
            <div className="sticky top-0 z-30 shadow-sm">
              <SidebarHeader
                collapsed={false}
                isDesktop={false}
                onToggleCollapse={() => {}}
                onCloseDrawer={() => setDrawerOpen(false)}
              />
            </div>
            <div className="flex-1 overflow-auto">{SidebarMenu}</div>
          </div>
        </Drawer>
      )}

      {/* MAIN AREA */}
      <Layout className="min-h-0" style={{ minHeight: "100dvh" }}>
        {/* ÜST BAR */}
        <div className="bg-[#0A4875] h-[64px] flex items-center justify-center sticky top-0 z-40">
          <div className={`flex items-center ${collapsed ? "gap-1" : "gap-12"}`}>
            {!isDesktop && (
              <Button
                type="text"
                shape="circle"
                aria-label="Menüyü aç"
                className="!text-white hover:!bg-white/10"
                icon={<MenuOutlined />}
                onClick={() => setDrawerOpen(true)}
              />
            )}

            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                gap: 8,
                position: "absolute",
                top: "1rem",
                right: "0.5rem",
              }}
            >
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: [
                    { key: "profile", icon: <UserOutlined />, label: "Profil" },
                    { type: "divider" },
                    { key: "logout", icon: <LogoutOutlined />, label: "Çıkış" },
                  ],
                  onClick: ({ key }) => {
                    if (key === "profile") router.push("/user");
                    if (key === "logout") router.push("/login");
                  },
                }}
              >
                <div className="cursor-pointer flex items-center gap-2">
                  {companyName && (
                    <span
                      className="text-white max-w-[220px] truncate"
                      title={companyName}
                      style={{ lineHeight: 1 }}
                    />
                  )}
                  <Avatar
                    alt="Profil"
                    src={avatarSrc}
                    size={36}
                    className="bg-[#0766AD]"
                  >
                    {initialsFrom(me) || "AA"}
                  </Avatar>
                </div>
              </Dropdown>
            </div>
          </div>
        </div>

        {/* İÇERİK */}
        <Content
          className="min-h-0"
          style={{ minHeight: 0, overflow: "auto", padding: "24px 24px" }}
        >
          <div style={{ marginInline: "auto", maxWidth: 1280 }}>
            <div
              className="bg-white rounded-2xl shadow"
              style={{ background: "white", borderRadius: 16, padding: 16 }}
            >
              {children}
            </div>
          </div>
        </Content>

        <Footer style={{ textAlign: "center", background: "transparent" }}>
          © {new Date().getFullYear()} — U2 Soft - Software & Technology Solutions |
          All Rights Reserved
        </Footer>
      </Layout>
    </Layout>
  );
}
