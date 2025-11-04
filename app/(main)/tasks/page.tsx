"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  Button,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  DatePicker,
  notification,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  CheckOutlined,
  DeleteOutlined,
  BellOutlined,
} from "@ant-design/icons";

/* ---------------------- TYPE TANIMLARI ---------------------- */
type TaskBadge = "PENDING" | "COMPLETED" | "ARCHIVED";

interface TaskCategoryResponse {
  id: number;
  name: string;
  type: "WORK" | "PERSONAL" | "STUDY";
  color: string;
}

interface TaskResponse {
  id: number;
  task: string;
  collection?: string;
  description?: string;
  badge: TaskBadge;
  category?: TaskCategoryResponse | null;
  remindAt?: string | null;
}

interface TaskRequest {
  task: string;
  collection?: string;
  description?: string;
  badge?: TaskBadge;
  categoryId?: number;
  remindAt?: string | null;
}

/* ---------------------- API AYARLARI ---------------------- */
const API = "http://localhost:8080";

async function apiFetch(url: string, options: RequestInit = {}) {
  const token =
    localStorage.getItem("token") || localStorage.getItem("jwtToken");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/* ---------------------- YARDIMCI FONKSİYONLAR ---------------------- */
const fmtDate = (iso?: string | null) =>
  iso ? iso.replace("T", " ") : "";

const nowTs = () => Date.now();

/* ---------------------- ANA BİLEŞEN ---------------------- */
export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  // Hatırlatma kontrolleri
  const PRE_ALERT_MIN = 5;
  const REPEAT_MS = 60_000;
  const POLL_MS = 10_000;
  const lastNotifiedRef = useRef<Map<number, number>>(new Map());

  /* ---------------------- GÖREVLERİ YÜKLE ---------------------- */
  const loadTasks = async () => {
    try {
      const data = await apiFetch(`${API}/api/tasks`);
      setTasks(data ?? []);
    } catch (err) {
      notification.error({
        message: "Görevler alınamadı",
        description: String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    const iv = setInterval(loadTasks, POLL_MS);
    return () => clearInterval(iv);
  }, []);

  /* ---------------------- HATIRLATMA MEKANİĞİ ---------------------- */
  useEffect(() => {
    if (!tasks.length) return;

    const now = nowTs();
    tasks.forEach((t) => {
      if (t.badge === "COMPLETED") {
        lastNotifiedRef.current.delete(t.id);
        return;
      }

      const lastN = lastNotifiedRef.current.get(t.id) ?? 0;
      if (now - lastN < REPEAT_MS) return;

      const remindAt = t.remindAt ? new Date(t.remindAt).getTime() : null;
      if (!remindAt) return;

      const minutesDiff = Math.floor((remindAt - now) / 60000);

      if (t.badge === "PENDING" && minutesDiff <= PRE_ALERT_MIN && minutesDiff >= 0) {
        notification.info({
          key: `pre-${t.id}`,
          message: "Yaklaşan Görev",
          description: `“${t.task}” için hatırlatma ${minutesDiff} dk içinde.`,
          icon: <BellOutlined />,
          duration: 4,
        });
        lastNotifiedRef.current.set(t.id, now);
        return;
      }

      if (remindAt <= now && (t.badge === "PENDING" || t.badge === "ARCHIVED")) {
        notification.warning({
          key: `due-${t.id}`,
          message: "Süresi Dolan Görev",
          description: `“${t.task}” için hatırlatma zamanı geldi!`,
          icon: <BellOutlined />,
          duration: 4,
        });
        lastNotifiedRef.current.set(t.id, now);
      }
    });
  }, [tasks]);

  /* ---------------------- GÖREV EKLE ---------------------- */
  const handleAddTask = async () => {
    try {
      const values = await form.validateFields();
      const req: TaskRequest = {
        task: values.task,
        description: values.description,
        badge: "PENDING",
        remindAt: values.remindAt
          ? values.remindAt.format("YYYY-MM-DDTHH:mm:ss")
          : null,
      };

      await apiFetch(`${API}/api/tasks`, {
        method: "POST",
        body: JSON.stringify(req),
      });

      notification.success({ message: "Görev eklendi" });
      form.resetFields();
      setIsModalOpen(false);
      loadTasks();
    } catch (err) {
      notification.error({
        message: "Görev eklenemedi",
        description: String(err),
      });
    }
  };

  /* ---------------------- GÖREV TAMAMLA ---------------------- */
  const completeTask = async (record: TaskResponse) => {
    try {
      await apiFetch(`${API}/api/tasks/${record.id}/complete`, {
        method: "PUT",
      });

      notification.success({ message: "Görev tamamlandı" });
      lastNotifiedRef.current.delete(record.id);
      // Anında görünümde de badge değiştir (yenileme beklemeden)
      setTasks((prev) =>
        prev.map((t) =>
          t.id === record.id ? { ...t, badge: "COMPLETED" } : t
        )
      );
    } catch (err) {
      notification.error({
        message: "Tamamlanamadı",
        description: String(err),
      });
    }
  };

  /* ---------------------- GÖREV SİL ---------------------- */
  const deleteTask = async (id: number) => {
    try {
      await apiFetch(`${API}/api/tasks/${id}`, { method: "DELETE" });
      notification.success({ message: "Görev silindi" });
      lastNotifiedRef.current.delete(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      notification.error({
        message: "Silinemedi",
        description: String(err),
      });
    }
  };

  /* ---------------------- TABLO SÜTUNLARI ---------------------- */
  const columns = useMemo(
    () => [
      { title: "Görev", dataIndex: "task", key: "task" },
      { title: "Açıklama", dataIndex: "description", key: "description" },
      {
        title: "Durum",
        dataIndex: "badge",
        key: "badge",
        render: (badge: TaskBadge) => {
          const color =
            badge === "COMPLETED" ? "green" : badge === "ARCHIVED" ? "red" : "blue";
          const label =
            badge === "COMPLETED" ? "Tamamlandı" : badge === "ARCHIVED" ? "Süresi Doldu" : "Bekliyor";
          return <Tag color={color}>{label}</Tag>;
        },
      },
      {
        title: "Hatırlatma",
        dataIndex: "remindAt",
        key: "remindAt",
        render: (remindAt: string | null) =>
          remindAt ? (
            <Tag color="purple">{fmtDate(remindAt)}</Tag>
          ) : (
            <Tag>Yok</Tag>
          ),
      },
      {
        title: "Aksiyon",
        key: "action",
        render: (_: any, record: TaskResponse) => (
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              size="small"
              type="default"
              icon={<CheckOutlined />}
              disabled={record.badge === "COMPLETED"}
              onClick={() => completeTask(record)}
            >
              Tamamla
            </Button>

            <Popconfirm
              title="Görev silinsin mi?"
              okText="Evet"
              cancelText="İptal"
              onConfirm={() => deleteTask(record.id)}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                Sil
              </Button>
            </Popconfirm>
          </div>
        ),
      },
    ],
    []
  );

  /* ---------------------- RENDER ---------------------- */
  return (
    <Card
      title="Görevlerim"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
        >
          Yeni Görev
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        columns={columns as any}
        dataSource={tasks}
        pagination={{ pageSize: 8 }}
      />

      <Modal
        title="Yeni Görev Ekle"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleAddTask}
        okText="Kaydet"
        cancelText="İptal"
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            name="task"
            label="Görev Başlığı"
            rules={[{ required: true, message: "Görev adı zorunludur!" }]}
          >
            <Input placeholder="Örn: Fatura modülünü test et" />
          </Form.Item>

          <Form.Item name="description" label="Açıklama">
            <Input.TextArea rows={3} placeholder="Görev hakkında detay" />
          </Form.Item>

          <Form.Item name="remindAt" label="Hatırlatma Tarihi">
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              style={{ width: "100%" }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
