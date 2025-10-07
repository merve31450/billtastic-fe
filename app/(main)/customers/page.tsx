'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  App,
  Alert,
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
import dayjs, { Dayjs } from 'dayjs';
import * as XLSX from 'xlsx';
import {
  PlusOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

/* ───────────── Tipler ───────────── */
export type RowData = {
  id?: number;
  companyName: string;
  contactName: string;
  invoiceNumber: string;
  /** Backend ISO 8601 tarih (yyyy-MM-dd) */
  dueDate: string;
  euroAmount: number;
  dollarAmount: number;
  tlAmount: number;
  priority: string;
  receivableTotal: number;
  creationDate: string;
  invoiceEmail: string;
};

/* ───────────── Yardımcılar ───────────── */
const fmtISODate = (d: string | Date) => {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().split('T')[0];
};


const formatCurrency = (val: number, cur: string) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);

/* ───────────── API ───────────── */
type HttpError = Error & { status?: number; body?: unknown };

async function apiFetch(url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    credentials: 'include',
  });
  if (!res.ok) {
    const err: HttpError = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    try {
      err.body = await res.json();
    } catch {
      err.body = await res.text();
    }
    throw err;
  }
  return res;
}

/* ───────────── Sayfa ───────────── */
export default function CustomersPage() {
  const { message, notification } = App.useApp();

  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterText, setFilterText] = useState('');
  const [exUsdTry, setExUsdTry] = useState<number | null>(null); // 1 USD kaç TL
  const [exEurTry, setExEurTry] = useState<number | null>(null); // 1 EUR kaç TL
  const [fxError, setFxError] = useState<string | null>(null);

  // Form (ekle/düzenle)
  const [openForm, setOpenForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<RowData>();
  const [editingId, setEditingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!filterText) return rows;
    const q = filterText.toLowerCase();
    return rows.filter((r) =>
      Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q))
    );
  }, [rows, filterText]);

  /* ---------- Müşteri listesi ---------- */
  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('http://localhost:8080/api/customers');
      const list = await res.json();
      setRows(
        list.map((it: RowData) => ({
          ...it,
          dueDate: fmtISODate(it.dueDate),
        }))
      );
    } catch (e: unknown) {
      const err = e as { status?: number; body?: unknown; message?: string };
      const s = err?.status;
      notification.error({
        message: 'Müşteri listesi alınamadı',
        description:
          (s ? `Server ${s} returned. ` : '') +
          (typeof err?.body === 'string' ? err.body : (err?.body as { message?: string })?.message || err?.message),
      });
    } finally {
      setLoading(false);
    }
  };



  /* ---------- Kur bilgisi ---------- */
  useEffect(() => {
    (async () => {
      try {
        // TRY bazlı kur: 1 TRY -> rates.USD
        // 1 USD kaç TL? => 1 / rates.USD
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/TRY');
        const d = await res.json();
        setExUsdTry(1 / d.rates.USD);
        setExEurTry(1 / d.rates.EUR);
        setFxError(null);
      } catch {
        setFxError('Döviz kuru verisi alınamadı.');
      }
    })();
  }, []);

  /* ---------- TL hesaplama ---------- */
  const calcTL = (amt: number, cur: 'USD' | 'EUR') => {
    if (cur === 'USD' && exUsdTry) return amt * exUsdTry;
    if (cur === 'EUR' && exEurTry) return amt * exEurTry;
    return amt;
  };

  /* ---------- Ekle / Düzenle ---------- */
  const startAdd = () => {
  setEditingId(null);
  form.setFieldsValue({
    companyName: '',
    contactName: '',
    invoiceNumber: '',
    dueDate: dayjs().format('YYYY-MM-DD'), // ✅ burası string olmalı
    euroAmount: 0,
    dollarAmount: 0,
    tlAmount: 0,
    priority: 'Önceliksiz',
    receivableTotal: 0,
    creationDate: '',
    invoiceEmail: '',
  });
  setOpenForm(true);
};

  const startEdit = (row: RowData) => {
  setEditingId(row.id!);
  form.setFieldsValue({
    ...row,
    dueDate: row.dueDate ? row.dueDate : undefined, // string veya undefined olmalı
  });
  setOpenForm(true);
};


  const handleDelete = (id?: number) => {
    if (!id) return;
    Modal.confirm({
      title: 'Kaydı sil',
      content: 'Bu kayıt kalıcı olarak silinecek. Emin misiniz?',
      okType: 'danger',
      okText: 'Sil',
      cancelText: 'İptal',
      onOk: async () => {
        try {
          const res = await fetch(`http://localhost:8080/api/customers/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            const txt = await res.text();
            const err: HttpError = new Error(`HTTP ${res.status}`);
            err.status = res.status;
            err.body = txt;
            throw err;
          }
          setRows((prev) => prev.filter((r) => r.id !== id));
          message.success('Kayıt silindi');
        } catch (e: unknown) {
          const err = e as { status?: number; body?: unknown; message?: string };
          notification.error({
            message: 'Silme başarısız',
            description:
              (err?.status ? `Sunucu ${err.status} döndürdü. ` : '') +
              (typeof err?.body === 'string' ? err.body : err?.message),
          });
        }
      },
    });
  };

  /* ---------- Kaydet ---------- */
  const onSave = async () => {
    try {
      const values = await form.validateFields();

      const normalized: RowData = {
        ...values,
        companyName: values.companyName?.toUpperCase(),
        contactName: values.contactName?.toUpperCase(),
        dueDate: fmtISODate(values.dueDate ? (values.dueDate as unknown as Dayjs).toDate() : values.dueDate),
        receivableTotal: Number(
          (
            calcTL(Number(values.dollarAmount || 0), 'USD') +
            calcTL(Number(values.euroAmount || 0), 'EUR') +
            Number(values.tlAmount || 0)
          ).toFixed(2)
        ),
        creationDate: fmtISODate(new Date()),
      };

      setSaving(true);

      const isUpdate = editingId != null;
      const url = isUpdate
        ? `http://localhost:8080/api/customers/${editingId}`
        : 'http://localhost:8080/api/customers';
      const method = isUpdate ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(isUpdate ? { ...normalized, id: editingId } : normalized),
      });
      const saved: RowData = await res.json();

      setRows((prev) =>
        isUpdate ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved]
      );

      setOpenForm(false);
      setEditingId(null);
      form.resetFields();
      message.success(isUpdate ? 'Kayıt güncellendi' : 'Kayıt eklendi');
    } catch (e: unknown) {
      // antd form validation error
      if (typeof e === 'object' && e !== null && 'errorFields' in e) return;
      const s = typeof e === 'object' && e !== null && 'status' in e ? (e as { status?: number }).status : undefined;
      notification.error({
        message: 'Kaydetme hatası',
        description:
          (s ? `Server ${s} returned. ` : '') +
          (typeof e === 'object' && e !== null && 'body' in e
            ? (typeof (e as { body?: unknown }).body === 'string'
                ? (e as { body?: string }).body
                : (typeof (e as { body?: { message?: string } }).body === 'object' &&
                    (e as { body?: { message?: string } }).body !== undefined &&
                    'message' in (e as { body?: { message?: string } }).body!
                    ? ((e as { body?: { message?: string } }).body as { message?: string }).message
                    : (e as { message?: string }).message || 'Bilinmeyen hata'))
            : (e as { message?: string })?.message || 'Bilinmeyen hata'),
      });
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Excel Export ---------- */
  const exportExcel = () => {
    const headers = [
      'No',
      'Firma Adı',
      'Yetkili Adı',
      'Fatura No',
      'Vade Tarihi',
      'Euro Tutar',
      'Dolar Tutar',
      'TL Tutar',
      'Öncelik',
      'Alacak Toplam',
      'Ekleme Tarihi',
      'E-posta',
    ];
    const formatted = rows.map((item, i) => ({
      No: i + 1,
      'Firma Adı': item.companyName,
      'Yetkili Adı': item.contactName,
      'Fatura No': item.invoiceNumber,
      'Vade Tarihi': item.dueDate,
      'Euro Tutar': item.euroAmount,
      'Dolar Tutar': item.dollarAmount,
      'TL Tutar': item.tlAmount,
      Öncelik: item.priority,
      'Alacak Toplam': item.receivableTotal,
      'Ekleme Tarihi': item.creationDate,
      'E-posta': item.invoiceEmail,
    }));
    const ws = XLSX.utils.json_to_sheet(formatted, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `Müşteri Listesi_${fmtISODate(new Date())}.xlsx`);
    message.success('Excel oluşturuldu');
  };

  /* ---------- Kolonlar ---------- */
  const columns: ColumnsType<RowData> = [
    {
      title: 'Firma Adı',
      dataIndex: 'companyName',
      sorter: (a, b) => a.companyName.localeCompare(b.companyName),
      ellipsis: true,
    },
    {
      title: 'Yetkili Adı',
      dataIndex: 'contactName',
      sorter: (a, b) => a.contactName.localeCompare(b.contactName),
      ellipsis: true,
    },
    {
      title: 'Fatura No',
      dataIndex: 'invoiceNumber',
      sorter: (a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber),
      ellipsis: true,
    },
    {
      title: 'Vade Tarihi',
      dataIndex: 'dueDate',
      render: (v) => dayjs(v).format('DD.MM.YYYY'),
      sorter: (a, b) => dayjs(a.dueDate).unix() - dayjs(b.dueDate).unix(),
      width: 140,
    },
    {
      title: '₺ TL',
      dataIndex: 'tlAmount',
      render: (v) => formatCurrency(v, 'TRY'),
      sorter: (a, b) => a.tlAmount - b.tlAmount,
      align: 'right' as const,
      width: 140,
    },
    {
      title: '$ Dolar',
      dataIndex: 'dollarAmount',
      render: (v) => formatCurrency(v, 'USD'),
      sorter: (a, b) => a.dollarAmount - b.dollarAmount,
      align: 'right' as const,
      width: 140,
    },
    {
      title: '€ Euro',
      dataIndex: 'euroAmount',
      render: (v) => formatCurrency(v, 'EUR'),
      sorter: (a, b) => a.euroAmount - b.euroAmount,
      align: 'right' as const,
      width: 140,
    },
    {
      title: 'Öncelik',
      dataIndex: 'priority',
      render: (p: string) => {
        if (p === 'Yüksek Öncelikli') return <Tag color="error">{p}</Tag>;
        if (p === 'Öncelikli') return <Tag color="warning">{p}</Tag>;
        return <Tag color="success">{p || 'Önceliksiz'}</Tag>;
      },
      filters: [
        { text: 'Yüksek Öncelikli', value: 'Yüksek Öncelikli' },
        { text: 'Öncelikli', value: 'Öncelikli' },
        { text: 'Önceliksiz', value: 'Önceliksiz' },
      ],
      onFilter: (val, r) => r.priority === val,
      width: 160,
    },
    {
      title: 'Alacak',
      dataIndex: 'receivableTotal',
      render: (v) => formatCurrency(Number(v || 0), 'TRY'),
      sorter: (a, b) => a.receivableTotal - b.receivableTotal,
      align: 'right' as const,
      width: 160,
    },
    {
      title: 'Ekleme',
      dataIndex: 'creationDate',
      render: (v) => (v ? dayjs(v).format('DD.MM.YYYY') : '-'),
      sorter: (a, b) => dayjs(a.creationDate).unix() - dayjs(b.creationDate).unix(),
      width: 140,
    },
    {
      title: 'E-posta',
      dataIndex: 'invoiceEmail',
      ellipsis: true,
    },
    {
      title: 'Aksiyon',
      key: 'actions',
      fixed: 'right',
      width: 140,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => startEdit(r)}>
            Düzenle
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)}>
            Sil
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="min-h-[80vh] p-4">
      <Card className="rounded-2xl">
        <Row gutter={[12, 12]} align="middle" className="mb-2">
          <Col span={24}>
            <Title level={4} className="!mb-0">
              Müşteri Listesi
            </Title>
            <Text type="secondary">Kayıtları görüntüleyin, düzenleyin ve Excel’e aktarın.</Text>
          </Col>
        </Row>

        <Row gutter={[12, 12]} className="mb-3">
          <Col xs={24} md={10}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Ara (firma, kişi, fatura, e-posta...)"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </Col>
          <Col xs={24} md={14} className="flex gap-2 justify-end">
            <Button icon={<ReloadOutlined />} onClick={load} />
            <Button icon={<DownloadOutlined />} onClick={exportExcel}>
              Excel’e Aktar
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={startAdd}>
              Yeni Satır Ekle
            </Button>
          </Col>
        </Row>

        {fxError && (
          <Alert
            className="mb-3"
            type="warning"
            showIcon
            message="Kur bilgisi alınamadı"
            description={fxError}
          />
        )}

        <Table<RowData>
          rowKey={(r) => String(r.id ?? `${r.companyName}-${r.invoiceNumber}`)}
          columns={columns}
          dataSource={filtered}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1100 }}
        />
      </Card>

      {/* Ekle/Düzenle Modal */}
      <Modal
        open={openForm}
        title={editingId ? 'Kaydı Düzenle' : 'Yeni Kayıt'}
        onCancel={() => setOpenForm(false)}
        okText={editingId ? 'Güncelle' : 'Kaydet'}
        onOk={onSave}
        confirmLoading={saving}
        destroyOnHidden={true}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Firma Adı"
            name="companyName"
            rules={[{ required: true, message: 'Zorunlu alan' }]}
          >
            <Input placeholder="Firma Adı" />
          </Form.Item>
          <Form.Item
            label="Yetkili Adı"
            name="contactName"
            rules={[{ required: true, message: 'Zorunlu alan' }]}
          >
            <Input placeholder="Yetkili Adı" />
          </Form.Item>
          <Form.Item
            label="Fatura No"
            name="invoiceNumber"
            rules={[{ required: true, message: 'Zorunlu alan' }]}
          >
            <Input placeholder="Fatura No" />
          </Form.Item>
          <Form.Item
  label="Vade Tarihi"
  name="dueDate"
  rules={[{ required: true, message: 'Vade tarihi zorunludur' }]}
  getValueProps={(value) => ({
    value: value ? dayjs(value, 'YYYY-MM-DD') : null,
  })}
  getValueFromEvent={(date: Dayjs | null) =>
    date ? date.format('YYYY-MM-DD') : undefined
  }
>
  <DatePicker
    className="w-full"
    format="YYYY-MM-DD"
    getPopupContainer={(t) => t.parentElement!}
  />
</Form.Item>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="₺ TL Tutar" name="tlAmount" initialValue={0}>
                <Input type="number" step="0.01" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="$ Dolar Tutar" name="dollarAmount" initialValue={0}>
                <Input type="number" step="0.01" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="€ Euro Tutar" name="euroAmount" initialValue={0}>
                <Input type="number" step="0.01" />
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
