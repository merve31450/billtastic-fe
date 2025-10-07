'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  App,
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Form,
  Image as AntImage,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  notification,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PrinterOutlined,
  DownloadOutlined,
  SaveOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/tr';
import { useReactToPrint } from 'react-to-print';

dayjs.locale('tr');

const { Title, Text } = Typography;

/* =========================================================
   Types
========================================================= */
type InvoiceItem = {
  key: string;
  description: string;
  unitPrice: number;
  quantity: number;
};

type CompanyData = {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  bankAccount: string;
  accountHolder: string;
};

type HttpError = Error & { status?: number; bodyText?: string };

/* =========================================================
   Helpers
========================================================= */
const fmtCurrency = (n: number, cur: string = 'TRY') =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: cur }).format(
    isFinite(n) ? n : 0
  );

async function apiFetch(url: string, init: RequestInit = {}) {
  const token =
    typeof window !== 'undefined' &&
    (localStorage.getItem('jwtToken') || localStorage.getItem('token'));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const err: HttpError = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    try {
      err.bodyText = await res.text();
    } catch {
      /* noop */
    }
    throw err;
  }
  return res;
}

/* =========================================================
   Page (wrap with Ant App provider)
========================================================= */
export default function Page() {
  return (
    <App>
      <InvoicePageInner />
    </App>
  );
}

/* =========================================================
   Inner Page
========================================================= */
function InvoicePageInner() {
  const { message, modal } = App.useApp();

  /* -------- Company / Meta -------- */
  const [company, setCompany] = useState<CompanyData>({
    companyName: 'AABC',
    address: '2972 Westheimer Rd. Santa Ana, Illinois 85486',
    phone: '(219) 555-0114',
    email: 'firma@mail.com',
    website: 'www.firmawebsitesi.com',
    bankAccount: '0981234098765',
    accountHolder: 'Leslie Alexander',
  });

  const [invoiceNo, setInvoiceNo] = useState('VL25000365');
  const [invoiceDate, setInvoiceDate] = useState<Dayjs>(dayjs());
  const [accountNo, setAccountNo] = useState('0981234098765');

  /* -------- Items -------- */
  const [items, setItems] = useState<InvoiceItem[]>([
    { key: '1', description: 'Danışmanlık', unitPrice: 1000, quantity: 3 },
    { key: '2', description: 'Tasarım', unitPrice: 800, quantity: 2 },
  ]);

  /* -------- Totals -------- */
  const [vatRate, setVatRate] = useState<number>(15); // %
  const [discount, setDiscount] = useState<number>(30); // TL

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + it.unitPrice * it.quantity, 0),
    [items]
  );
  const vat = useMemo(() => subtotal * (vatRate / 100), [subtotal, vatRate]);
  const totalDue = useMemo(() => subtotal + vat - discount, [subtotal, vat, discount]);

  /* -------- Item Modal -------- */
  const [itemForm] = Form.useForm<InvoiceItem>();
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const openAddItem = () => {
    setEditingKey(null);
    itemForm.resetFields();
    itemForm.setFieldsValue({ description: '', unitPrice: 0, quantity: 1 });
    setItemModalOpen(true);
  };

  const openEditItem = (row: InvoiceItem) => {
    setEditingKey(row.key);
    itemForm.setFieldsValue({ ...row });
    setItemModalOpen(true);
  };

  const saveItem = async () => {
    const values = await itemForm.validateFields();
    const normalized: InvoiceItem = {
      key: editingKey ?? Math.random().toString(36).slice(2),
      description: values.description,
      unitPrice: Number(values.unitPrice || 0),
      quantity: Number(values.quantity || 0),
    };
    setItems((prev) =>
      editingKey ? prev.map((it) => (it.key === editingKey ? normalized : it)) : [...prev, normalized]
    );
    setItemModalOpen(false);
    setEditingKey(null);
  };

  const deleteItem = (row: InvoiceItem) => {
    Modal.confirm({
      title: 'Kalemi sil',
      content: `"${row.description}" kalemi silinecek. Emin misiniz?`,
      okType: 'danger',
      onOk: () => setItems((prev) => prev.filter((it) => it.key !== row.key)),
    });
  };

  /* -------- Company Modal -------- */
  const [companyForm] = Form.useForm<CompanyData>();
  const [companyModalOpen, setCompanyModalOpen] = useState(false);

  const openCompany = () => {
    companyForm.setFieldsValue(company);
    setCompanyModalOpen(true);
  };
  const saveCompany = async () => {
    const values = await companyForm.validateFields();
    setCompany(values);
    setCompanyModalOpen(false);
    message.success('Firma bilgileri güncellendi');
  };

  /* -------- Print / PDF -------- */
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Fatura_${invoiceNo}`,
  });

  const saveAndDownloadPdf = async () => {
    const payload = {
      ...company,
      invoiceNo,
      date: invoiceDate.format('YYYY-MM-DD'),
      accountNo,
      vatRate,
      discount,
      subtotal: subtotal.toFixed(2),
      vat: vat.toFixed(2),
      totalAmount: totalDue.toFixed(2),
      items: items.map((it) => ({
        description: it.description,
        unitPrice: it.unitPrice.toFixed(2),
        quantity: String(it.quantity),
      })),
    };

    try {
      const res = await apiFetch('http://localhost:8080/api/invoices/save-and-pdf', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fatura_${invoiceNo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('Fatura kaydedildi ve PDF indirildi');
    } catch (e: unknown) {
      let s: number | undefined;
      let detail: string;
      if (typeof e === 'object' && e !== null) {
        s = (e as { status?: number }).status;
        const bodyText = (e as { bodyText?: string }).bodyText;
        const messageText = (e as { message?: string }).message;
        detail =
          (s ? `Sunucu ${s} döndürdü. ` : '') + (bodyText || messageText || 'Bilinmeyen hata');
      } else {
        detail = 'Bilinmeyen hata';
      }
      notification.error({ message: 'PDF oluşturma başarısız', description: detail });
      if (s === 401 || s === 403) {
        setTimeout(() => (window.location.href = '/login'), 600);
      }
    }
  };

  /* -------- Table -------- */
  const columns: ColumnsType<InvoiceItem> = [
    { title: '#', dataIndex: 'key', width: 64, render: (_v, _r, i) => i + 1 },
    {
      title: 'Ürün / Hizmet',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: 'Birim Fiyat',
      dataIndex: 'unitPrice',
      align: 'right',
      width: 160,
      render: (v: number) => fmtCurrency(v),
      sorter: (a, b) => a.unitPrice - b.unitPrice,
    },
    {
      title: 'Adet',
      dataIndex: 'quantity',
      align: 'right',
      width: 120,
      sorter: (a, b) => a.quantity - b.quantity,
    },
    {
      title: 'Ara Toplam',
      key: 'line',
      align: 'right',
      width: 180,
      render: (_, r) => (
        <Text strong className="text-emerald-600">
          {fmtCurrency(r.unitPrice * r.quantity)}
        </Text>
      ),
      sorter: (a, b) => a.unitPrice * a.quantity - b.unitPrice * b.quantity,
    },
    {
      title: 'Aksiyon',
      key: 'actions',
      fixed: 'right',
      width: 160,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditItem(r)}>
            Düzenle
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteItem(r)}>
            Sil
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="min-h-[80vh] p-4">
      <Row gutter={[16, 16]}>
        {/* Header / Actions */}
        <Col span={24}>
          <Space className="w-full justify-between">
            <div>
              <Title level={3} className="!mb-0">
                Fatura
              </Title>
              <Text type="secondary">Önizleme, yazdırma ve PDF oluşturma</Text>
            </div>
            <Space.Compact>
              <Button icon={<PrinterOutlined />} onClick={handlePrint}>
                Yazdır
              </Button>
              <Button icon={<DownloadOutlined />} onClick={saveAndDownloadPdf} type="default">
                PDF Kaydet & İndir
              </Button>
              <Button icon={<SaveOutlined />} type="primary" onClick={openCompany}>
                Firma Bilgileri
              </Button>
            </Space.Compact>
          </Space>
        </Col>

        {/* Printable Area */}
        <Col span={24}>
          <Card className="rounded-2xl">
            <div ref={printRef} className="p-6">
              {/* Top Bar (Logo + Right Info) */}
              <Row gutter={[16, 16]} align="middle" className="mb-4">
                <Col xs={24} md={12}>
                  <AntImage
                    src="/logo-dark.png"
                    alt="logo"
                    preview={false}
                    width={180}
                    fallback="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>"
                  />
                </Col>
                <Col xs={24} md={12}>
                  <div className="w-full flex flex-wrap md:justify-end gap-4 py-3 px-4 rounded-lg text-white"
                       style={{ background: 'linear-gradient(291deg, #308e87 21.2%, #308e87 83.92%)' }}>
                    <Space className="mr-4">
                      <span className="opacity-90">☎</span>
                      <span className="font-medium">{company.phone}</span>
                    </Space>
                    <div className="border-l border-white/30 h-6" />
                    <Space className="mr-4">
                      <span className="opacity-90">✉</span>
                      <span className="font-medium">{company.email}</span>
                    </Space>
                    <div className="border-l border-white/30 h-6" />
                    <Space>
                      <span className="opacity-90">🌐</span>
                      <span className="font-medium">{company.website}</span>
                    </Space>
                  </div>
                </Col>
              </Row>

              {/* Address & Bank */}
              <Row gutter={[16, 16]} className="mb-2">
                <Col xs={24} md={12}>
                  <Card size="small" className="bg-emerald-50 border-emerald-100">
                    <Title level={5} className="!text-emerald-600 !mb-2">
                      Fatura
                    </Title>
                    <div className="flex flex-col">
                      <Text strong>{company.companyName}</Text>
                      <Text>{company.address}</Text>
                      <Text>Telefon: {company.phone}</Text>
                      <Text>E-posta: {company.email}</Text>
                      <Text>Website: {company.website}</Text>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card size="small">
                    <Title level={5} className="!text-emerald-600 !mb-2">
                      Banka Havalesi
                    </Title>
                    <div className="flex flex-col">
                      <Text strong>{company.accountHolder}</Text>
                      <Text>Banka Hesabı: {company.bankAccount}</Text>
                      <Text>Adres: {company.address}</Text>
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* Invoice Meta */}
              <Row gutter={[16, 16]} className="mb-4">
                <Col xs={24} md={6}>
                  <Card size="small" className="bg-emerald-50 border-emerald-100">
                    <Text type="secondary">Tarih</Text>
                    <div className="text-base font-semibold">{invoiceDate.format('DD MMM, YYYY')}</div>
                  </Card>
                </Col>
                <Col xs={24} md={6}>
                  <Card size="small" className="bg-emerald-50 border-emerald-100">
                    <Text type="secondary">Fatura No</Text>
                    <div className="text-base font-semibold">#{invoiceNo}</div>
                  </Card>
                </Col>
                <Col xs={24} md={6}>
                  <Card size="small" className="bg-emerald-50 border-emerald-100">
                    <Text type="secondary">Hesap No</Text>
                    <div className="text-base font-semibold">{accountNo}</div>
                  </Card>
                </Col>
                <Col xs={24} md={6}>
                  <Card size="small" className="bg-emerald-50 border-emerald-100">
                    <Text type="secondary">Vade / Tutar</Text>
                    <div className="text-base font-semibold">{fmtCurrency(totalDue)}</div>
                  </Card>
                </Col>
              </Row>

              {/* Items Table */}
              <Row className="mb-2">
                <Col span={24} className="flex justify-between items-center">
                  <Title level={5} className="!mb-0">
                    Kalemler
                  </Title>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openAddItem}>
                    Yeni Kalem
                  </Button>
                </Col>
                <Col span={24}>
                  <Table<InvoiceItem>
                    className="mt-2"
                    rowKey="key"
                    columns={columns}
                    dataSource={items}
                    pagination={{ pageSize: 6 }}
                    scroll={{ x: 900 }}
                  />
                </Col>
              </Row>

              {/* Totals */}
              <Row gutter={[16, 16]} justify="end" className="mt-2">
                <Col xs={24} md={12} lg={10} xl={8}>
                  <Card size="small" className="bg-emerald-50 border-emerald-100">
                    <Descriptions column={1} size="small" colon>
                      <Descriptions.Item label={<Text strong>Ara Toplam</Text>}>
                        <Tag color="default">{fmtCurrency(subtotal)}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item
                        label={
                          <Space>
                            <Text strong>KDV</Text>
                            <InputNumber
                              size="small"
                              min={0}
                              max={100}
                              addonAfter="%"
                              value={vatRate}
                              onChange={(v) => setVatRate(Number(v || 0))}
                              className="!w-28"
                            />
                          </Space>
                        }
                      >
                        <Tag color="processing">{fmtCurrency(vat)}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item
                        label={
                          <Space>
                            <Text strong>İndirim</Text>
                            <InputNumber
                              size="small"
                              min={0}
                              step={1}
                              value={discount}
                              onChange={(v) => setDiscount(Number(v || 0))}
                              className="!w-28"
                            />
                          </Space>
                        }
                      >
                        <Tag color="default">-{fmtCurrency(discount)}</Tag>
                      </Descriptions.Item>
                    </Descriptions>

                    <Divider className="!my-3" />

                    <div className="flex justify-between items-center">
                      <Text strong className="opacity-80">
                        Toplam Tutar
                      </Text>
                      <span className="px-4 py-2 rounded text-white font-semibold"
                            style={{ background: '#308e87' }}>
                        {fmtCurrency(totalDue)}
                      </span>
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* Signature */}
              <Row className="mt-8">
                <Col>
                  <div className="flex flex-col items-start">
                    <AntImage
                      src="/sign.png"
                      alt="sign"
                      preview={false}
                      width={160}
                      fallback="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>"
                    />
                    <span className="text-emerald-700 font-semibold">Laurine T. Ebbert</span>
                    <span className="text-sm opacity-80">(Designer)</span>
                  </div>
                </Col>
              </Row>
            </div>
          </Card>
        </Col>

        {/* Editing meta (inline controls) */}
        <Col span={24}>
          <Card className="rounded-2xl">
            <Row gutter={[12, 12]}>
              <Col xs={24} md={8}>
                <Input
                  addonBefore="Fatura No"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                />
              </Col>
              <Col xs={24} md={8}>
                <DatePicker
                  className="w-full"
                  value={invoiceDate}
                  onChange={(d) => setInvoiceDate(d ?? dayjs())}
                  format="DD.MM.YYYY"
                />
              </Col>
              <Col xs={24} md={8}>
                <Input
                  addonBefore="Hesap No"
                  value={accountNo}
                  onChange={(e) => setAccountNo(e.target.value)}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Item Modal */}
      <Modal
        open={itemModalOpen}
        onCancel={() => setItemModalOpen(false)}
        title={editingKey ? 'Kalemi Düzenle' : 'Yeni Kalem'}
        okText={editingKey ? 'Güncelle' : 'Ekle'}
        onOk={saveItem}
        destroyOnClose
      >
        <Form form={itemForm} layout="vertical">
          <Form.Item
            label="Açıklama"
            name="description"
            rules={[{ required: true, message: 'Zorunlu alan' }]}
          >
            <Input placeholder="Ürün / Hizmet açıklaması" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                label="Birim Fiyat (TL)"
                name="unitPrice"
                rules={[{ required: true }]}
              >
                <InputNumber className="w-full" min={0} step={0.01} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Adet" name="quantity" rules={[{ required: true }]}>
                <InputNumber className="w-full" min={1} step={1} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Company Modal */}
      <Modal
        open={companyModalOpen}
        onCancel={() => setCompanyModalOpen(false)}
        onOk={saveCompany}
        title="Firma Bilgileri"
        okText="Kaydet"
        destroyOnClose
      >
        <Form form={companyForm} layout="vertical">
          <Form.Item name="companyName" label="Firma" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Adres">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Telefon">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="E-posta" rules={[{ type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="website" label="Website">
            <Input />
          </Form.Item>
          <Form.Item name="accountHolder" label="Hesap Sahibi">
            <Input />
          </Form.Item>
          <Form.Item name="bankAccount" label="Banka Hesabı">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
