'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  ReloadOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;

/* =====================================
   1️ Tipler
===================================== */
export interface RowData {
  id?: number;
  companyName: string;
  contactName: string;
  invoiceEmail: string;
  invoiceNumber: string;
  euroAmount: number;
  dollarAmount: number;
  tlAmount: number;
  priority: string;
  receivableTotal: number;
  creationDate: string;
  dueDate: string;
}

/* =====================================
   2️Yardımcı Fonksiyonlar
===================================== */
const fmtISODate = (d: string | Date | null) => {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0];
};

/* =====================================
   3️Token'lı Fetch Fonksiyonu
===================================== */
async function apiFetch(url: string, init: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers || {}),
  };
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }
  return res;
}

/* =====================================
    Ana Bileşen
===================================== */
export default function CustomersPage() {
  const { message, notification } = App.useApp();

  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState('');

  const [form] = Form.useForm<RowData>();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  /* ---------- Listeyi Yükle ---------- */
  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('http://localhost:8080/api/customers');
      const data = await res.json();
      setRows(data);
    } catch (e) {
      notification.error({
        message: 'Müşteri listesi alınamadı',
        description: (e as Error).message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* ---------- Yeni Kayıt ---------- */
  const startAdd = () => {
    setEditingId(null);
    form.setFieldsValue({
      companyName: '',
      contactName: '',
      invoiceEmail: '',
      invoiceNumber: '',
      euroAmount: '',
      dollarAmount: '',
      tlAmount: '',
      priority: 'Önceliksiz',
      receivableTotal: 0,
      creationDate: fmtISODate(new Date()),
      dueDate: dayjs(),
    });
    setOpen(true);
  };

  /* ---------- Düzenleme ---------- */
  const startEdit = (row: RowData) => {
    setEditingId(row.id!);
    form.setFieldsValue({
      ...row,
      dueDate: row.dueDate ? dayjs(row.dueDate, 'YYYY-MM-DD') : dayjs(),
    });
    setOpen(true);
  };

  /* ---------- Kaydet ---------- */
  const onSave = async () => {
    try {
      const values = await form.validateFields();

      const dto: RowData = {
        ...values,
        euroAmount: Number(values.euroAmount || 0),
        dollarAmount: Number(values.dollarAmount || 0),
        tlAmount: Number(values.tlAmount || 0),
        receivableTotal:
          Number(values.tlAmount || 0) +
          Number(values.euroAmount || 0) * 36 +
          Number(values.dollarAmount || 0) * 33,
        creationDate: fmtISODate(new Date()),
        dueDate: values.dueDate
          ? fmtISODate(
              values.dueDate.toDate ? values.dueDate.toDate() : values.dueDate
            )
          : fmtISODate(new Date()),
      };

      const method = editingId ? 'PUT' : 'POST';
      const url = editingId
        ? `http://localhost:8080/api/customers/${editingId}`
        : 'http://localhost:8080/api/customers';

      setSaving(true);
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(dto),
      });
      const saved = await res.json();

      setRows((prev) =>
        editingId
          ? prev.map((r) => (r.id === saved.id ? saved : r))
          : [...prev, saved]
      );

      message.success(editingId ? 'Kayıt güncellendi' : 'Yeni müşteri eklendi');
      setOpen(false);
      form.resetFields();
    } catch (e: any) {
      console.error('Kaydetme hatası:', e);
      // Backend validation hatası (ör: fatura no yanlış)
      if (e instanceof Error && e.message.startsWith('HTTP 400')) {
        try {
          const errObj = JSON.parse(e.message.replace(/^HTTP 400:\s*/, ''));
          Object.values(errObj).forEach((msg) => message.error(String(msg)));
        } catch {
          message.error('Geçersiz veri! Fatura numarasını kontrol edin.');
        }
      } else {
        notification.error({
          message: 'Kaydetme hatası',
          description: (e as Error).message,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Sil ---------- */
  const handleDelete = (id?: number) => {
    if (!id) return;
    Modal.confirm({
      title: 'Kaydı Sil',
      content: 'Bu müşteri kaydı kalıcı olarak silinecek. Emin misiniz?',
      okType: 'danger',
      okText: 'Sil',
      cancelText: 'İptal',
      async onOk() {
        try {
          await apiFetch(`http://localhost:8080/api/customers/${id}`, {
            method: 'DELETE',
          });
          setRows((prev) => prev.filter((r) => r.id !== id));
          message.success('Kayıt silindi');
        } catch (e) {
          notification.error({
            message: 'Silme hatası',
            description: (e as Error).message,
          });
        }
      },
    });
  };

  /* ---------- Excel Export ---------- */
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Müşteriler');
    XLSX.writeFile(wb, `Musteriler_${fmtISODate(new Date())}.xlsx`);
    message.success('Excel dosyası oluşturuldu');
  };

  /* ---------- Kolonlar ---------- */
  const columns: ColumnsType<RowData> = [
    { title: 'Firma Adı', dataIndex: 'companyName' },
    { title: 'Yetkili Adı', dataIndex: 'contactName' },
    { title: 'Fatura No', dataIndex: 'invoiceNumber' },
    {
      title: 'Vade Tarihi',
      dataIndex: 'dueDate',
      render: (v) => (v ? dayjs(v).format('DD.MM.YYYY') : '-'),
    },
    {
      title: 'Öncelik',
      dataIndex: 'priority',
      render: (p) => {
        if (p === 'Yüksek Öncelikli') return <Tag color="error">{p}</Tag>;
        if (p === 'Öncelikli') return <Tag color="warning">{p}</Tag>;
        return <Tag color="success">{p || 'Önceliksiz'}</Tag>;
      },
    },
    { title: 'E-posta', dataIndex: 'invoiceEmail' },
    {
      title: 'İşlemler',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => startEdit(r)}>
            Düzenle
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(r.id)}
          >
            Sil
          </Button>
        </Space>
      ),
    },
  ];

  /* ---------- Render ---------- */
  return (
    <div className="p-4">
      <Card>
        <Row justify="space-between" align="middle" className="mb-3">
          <Col>
            <Title level={4}>Müşteri Listesi</Title>
            <Text type="secondary">
              Kayıtları görüntüleyin, düzenleyin ve Excel’e aktarın
            </Text>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={load} />
              <Button icon={<DownloadOutlined />} onClick={exportExcel}>
                Excel
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={startAdd}>
                Yeni Müşteri
              </Button>
            </Space>
          </Col>
        </Row>

        <Input
          prefix={<SearchOutlined />}
          placeholder="Ara (firma, kişi, fatura, e-posta...)"
          allowClear
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="mb-3"
        />

        <Table<RowData>
          rowKey={(r) => String(r.id ?? r.invoiceNumber)}
          columns={columns}
          dataSource={useMemo(() => {
            if (!filterText) return rows;
            const q = filterText.toLowerCase();
            return rows.filter((r) =>
              Object.values(r).some((v) =>
                String(v ?? '').toLowerCase().includes(q)
              )
            );
          }, [rows, filterText])}
          loading={loading}
          pagination={{ pageSize: 8 }}
        />
      </Card>

      {/* ---------- Modal ---------- */}
      <Modal
        open={open}
        title={editingId ? 'Kaydı Düzenle' : 'Yeni Müşteri'}
        onCancel={() => setOpen(false)}
        onOk={onSave}
        confirmLoading={saving}
        okText="Kaydet"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Firma Adı"
            name="companyName"
            rules={[{ required: true, message: 'Zorunlu alan' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Yetkili Adı"
            name="contactName"
            rules={[{ required: true, message: 'Zorunlu alan' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Fatura No"
            name="invoiceNumber"
            rules={[
              { required: true, message: 'Fatura numarası zorunludur' },
              {
                pattern: /^[A-Za-z0-9]{3}[0-9]{15}$/,
                message:
                  'Fatura numarası 3 haneli alfa-nümerik birim kodu ve 15 haneli rakamdan oluşmalıdır (toplam 18 karakter).',
              },
            ]}
          >
            <Input maxLength={18} placeholder="Örn: ABC000000000000123" />
          </Form.Item>

          <Form.Item
            label="Vade Tarihi"
            name="dueDate"
            rules={[{ required: true, message: 'Zorunlu alan' }]}
          >
            <DatePicker className="w-full" format="YYYY-MM-DD" />
          </Form.Item>

          <Row gutter={12}>
  <Col span={8}>
    <Form.Item label="₺ TL" name="tlAmount">
      <Input type="number" step="0.01" placeholder="₺ tutar girin" />
    </Form.Item>
  </Col>

  <Col span={8}>
    <Form.Item label="$ Dolar" name="dollarAmount">
      <Input type="number" step="0.01" placeholder="$ tutar girin" />
    </Form.Item>
  </Col>

  <Col span={8}>
    <Form.Item label="€ Euro" name="euroAmount">
      <Input type="number" step="0.01" placeholder="€ tutar girin" />
    </Form.Item>
  </Col>
</Row>


          <Form.Item label="Öncelik" name="priority" initialValue="Önceliksiz">
            <Select
              options={[
                { value: 'Yüksek Öncelikli', label: 'Yüksek Öncelikli' },
                { value: 'Öncelikli', label: 'Öncelikli' },
                { value: 'Önceliksiz', label: 'Önceliksiz' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="E-posta"
            name="invoiceEmail"
            rules={[
              { required: true, message: 'Zorunlu alan' },
              { type: 'email', message: 'Geçerli bir e-posta girin' },
            ]}
          >
            <Input placeholder="ornek@email.com" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
