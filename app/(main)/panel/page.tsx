"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, Row, Col, Statistic, Typography, Spin, Avatar } from "antd";
import {
  TeamOutlined,
  FileDoneOutlined,
  UserOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import { Gauge, Column } from "@ant-design/plots";
import { api } from "@/lib/api";
import {
  MessageOutlined,
  CheckCircleOutlined,
  StopOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

export default function DashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/dashboard/summary");
        setSummary(data);
      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hedefYuzdesi = useMemo(() => {
    if (!summary?.totalInvoices || !summary?.monthlyGoal) return 0;
    return summary.totalInvoices / summary.monthlyGoal;
  }, [summary]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Spin size="large" tip="Yükleniyor..." />
      </div>
    );
  }

  const salesData =
    summary?.calendarStats?.map((d: any) => ({
      tarih: new Date(d.day).toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "short",
      }),
      fatura: d.invoices,
    })) ?? [];

  return (
    <div className="p-8 bg-gray-50 min-h-[100vh]">
      <div className="mb-8">
        <Title level={3} className="!mb-1">
          Hoş geldin, {summary?.userName}
        </Title>
        <Text type="secondary">
          Günlük performans, müşteri ve görev istatistiklerin 👇
        </Text>
      </div>

      {/* İstatistik Kartları */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card className="rounded-2xl shadow-sm border-0 hover:shadow-md transition">
            <Statistic
              title="Toplam Müşteri"
              value={summary?.totalCustomers ?? 0}
              prefix={<TeamOutlined style={{ color: "#1677ff" }} />}
              valueStyle={{ color: "#1677ff" }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="rounded-2xl shadow-sm border-0 hover:shadow-md transition">
            <Statistic
              title="Toplam Görev"
              value={summary?.totalTasks ?? 0}
              prefix={<FileDoneOutlined style={{ color: "#faad14" }} />}
              valueStyle={{ color: "#faad14" }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="rounded-2xl shadow-sm border-0 hover:shadow-md transition">
            <Statistic
              title="Tamamlanan Görev"
              value={summary?.completedTasks ?? 0}
              prefix={<UserOutlined style={{ color: "#52c41a" }} />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="rounded-2xl shadow-sm border-0 hover:shadow-md transition">
            <Statistic
              title="Toplam Fatura"
              value={summary?.totalInvoices ?? 0}
              prefix={<DollarOutlined style={{ color: "#f5222d" }} />}
              valueStyle={{ color: "#f5222d" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Aylık Hedef ve Grafik */}
      <Row gutter={[16, 16]} className="mt-8">
        <Col xs={24} md={8}>
          <Card
            title="Aylık Hedef (Faturalara Göre)"
            className="rounded-2xl shadow-sm border-0 text-center"
          >
            <Gauge
              percent={hedefYuzdesi}
              range={{
                color: hedefYuzdesi > 0.8 ? "#52c41a" : "#1677ff",
              }}
              indicator={{
                pointer: { style: { stroke: "#1677ff" } },
                pin: { style: { stroke: "#1677ff" } },
              }}
              statistic={{
                title: {
                  content: `${(hedefYuzdesi * 100).toFixed(1)}%`,
                  style: {
                    color: "#1677ff",
                    fontSize: "24px",
                    fontWeight: 600,
                  },
                },
                content: {
                  content: `Hedef: ${summary?.monthlyGoal} fatura`,
                  style: { color: "#999" },
                },
              }}
            />
            <p className="mt-3 text-gray-500 text-sm">
              Bu ay {summary?.totalInvoices} fatura kesildi.{" "}
              {hedefYuzdesi >= 1
                ? "Hedefe ulaşıldı 🎉"
                : "Devam et, hedef yakın 🚀"}
            </p>
          </Card>
        </Col>

        <Col xs={24} md={16}>
          <Card
            title="Aylık Fatura Grafiği"
            className="rounded-2xl shadow-sm border-0"
          >
            <Column
              data={salesData}
              xField="tarih"
              yField="fatura"
              color="#1677ff"
              columnStyle={{ radius: [8, 8, 0, 0] }}
            />
          </Card>
        </Col>
      </Row>

      {/* Müşteriler + Son Aktivite */}
      <Row gutter={[16, 16]} className="mt-8">
        {/* Müşteriler */}
        <Col xs={24} md={14}>
          <Card
            title="Müşteriler"
            className="rounded-2xl shadow-sm border-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-gray-500 uppercase bg-gray-100">
                  <tr>
                    <th className="p-3">İsim</th>
                    <th className="p-3">E-posta</th>
                    <th className="p-3">Harcanmış</th>
                    <th className="p-3">Ülke</th>
                  </tr>
                </thead>
                <tbody>
                  {summary?.latestCustomers?.map((c: any, i: number) => (
                    <tr
                      key={i}
                      className="border-b hover:bg-gray-50 transition"
                    >
                      <td className="p-3 flex items-center gap-3">
                        <Avatar src={c.avatar} />
                        <span className="font-medium">{c.name}</span>
                      </td>
                      <td className="p-3">{c.email}</td>
                      <td className="p-3 text-green-600 font-semibold">
                        {c.spent?.toLocaleString("tr-TR")} ABD doları
                      </td>
                      <td className="p-3">{c.country}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!summary?.latestCustomers?.length && (
                <p className="text-gray-500 text-center mt-2">
                  Henüz müşteri eklenmemiş 🧾
                </p>
              )}
            </div>
          </Card>
        </Col>

        {/* Son Aktivite */}
        <Col xs={24} md={10}>
          <Card
            title="Son Aktivite"
            className="rounded-2xl shadow-sm border-0"
          >
            <div>
              <h4 className="text-gray-400 text-xs mb-2">BUGÜN</h4>
              {summary?.upcomingTasks?.slice(0, 3).map((task: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2 text-gray-700">
                    <MessageOutlined style={{ color: "#1677ff" }} />
                    <span>
                      <strong>{task.task}</strong> adlı görev{" "}
                      {task.completed ? "tamamlandı" : "devam ediyor"}
                    </span>
                  </div>
                  <a className="text-blue-600 text-xs cursor-pointer hover:underline">
                    Görünüm →
                  </a>
                </div>
              ))}

              <h4 className="text-gray-400 text-xs mt-4 mb-2">DÜN</h4>
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2 text-gray-700">
                  <CheckCircleOutlined style={{ color: "#52c41a" }} />
                  <span>5 görev başarıyla tamamlandı.</span>
                </div>
                <a className="text-blue-600 text-xs cursor-pointer hover:underline">
                  Görünüm →
                </a>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2 text-gray-700">
                  <StopOutlined style={{ color: "#ff4d4f" }} />
                  <span>2 görev iptal edildi.</span>
                </div>
                <a className="text-blue-600 text-xs cursor-pointer hover:underline">
                  Görünüm →
                </a>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
