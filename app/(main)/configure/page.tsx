'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Form,
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
   Yardımcılar
========================================================= */
const fmtCurrency = (n: number, cur: string = 'TRY') =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: cur }).format(
    isFinite(n) ? n : 0,
  );

type InvoiceItem = { key: string; description: string; unitPrice: number; quantity: number };
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

async function apiFetch(url: string, init: RequestInit = {}) {
  const token =
    typeof window !== 'undefined' &&
    (localStorage.getItem('jwtToken') || localStorage.getItem('token'));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const err: HttpError = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    try {
      err.bodyText = await res.text();
    } catch {}
    throw err;
  }
  return res;
}

/* =========================================================
   Sayfa (Ant Design App ile sarılmış)
========================================================= */
export default function InvoicePage() {
  return (
    <App>
      <InvoicePageInner />
    </App>
  );
}

/* =========================================================
   İçerik
========================================================= */
function InvoicePageInner() {
  const { message } = App.useApp();

  /* -------- Firma -------- */
  const [company, setCompany] = useState<CompanyData>({
    companyName: 'AABC',
    address: '2972 Westheimer Rd. Santa Ana, Illinois 85486',
    phone: '(219) 555-0114',
    email: 'firma@mail.com',
    website: 'www.firmawebsitesi.com',
    bankAccount: '0981234098765',
    accountHolder: 'Leslie Alexander',
  });
// 🔹 Fatura numarası dinamik ve benzersiz
const [invoiceNo, setInvoiceNo] = useState(() => {
  const unique = "VL" + Date.now().toString().slice(-8);
  return unique;
});

// 🔹 Fatura tarihi
const [invoiceDate, setInvoiceDate] = useState<Dayjs>(dayjs());

// 🔹 Hesap numarası (şirketin banka hesabı veya sabit bilgi)
const [accountNo, setAccountNo] = useState('0981234098765');


  /* -------- Kalemler -------- */
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [vatRate, setVatRate] = useState<number>(15);
  const [discount, setDiscount] = useState<number>(0);

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + it.unitPrice * it.quantity, 0),
    [items],
  );
  const vat = useMemo(() => subtotal * (vatRate / 100), [subtotal, vatRate]);
  const totalDue = useMemo(() => subtotal + vat - discount, [subtotal, vat, discount]);

  /* -------- Kalem Modal -------- */
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
    itemForm.setFieldsValue(row);
    setItemModalOpen(true);
  };

  /* -------- Firma Modal -------- */
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

  /* -------- Yazdır / PDF -------- */
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Fatura_${invoiceNo}`,
  });

  /* =========================================================
     1) Tek kalem ekle/güncelle → state + backend
  ========================================================= */
  const saveItem = async () => {
    const values = await itemForm.validateFields();
    const normalized: InvoiceItem = {
      key: editingKey ?? Math.random().toString(36).slice(2),
      description: values.description,
      unitPrice: Number(values.unitPrice),
      quantity: Number(values.quantity),
    };

    setItems((prev) =>
      editingKey ? prev.map((it) => (it.key === editingKey ? normalized : it)) : [...prev, normalized],
    );
    setItemModalOpen(false);
    setEditingKey(null);

    try {
      const payload = buildPayload([...items.filter((i) => i.key !== editingKey), normalized]);
      await apiFetch('http://localhost:8080/api/invoices/save', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      message.success('Kalem kaydedildi');
    } catch (err: any) {
      showError('Kaydetme hatası', err);
    }
  };

  /* =========================================================
     2) Tüm faturayı kaydet
  ========================================================= */
  const handleSaveInvoice = async () => {
    try {
      await apiFetch('http://localhost:8080/api/invoices/save', {
        method: 'POST',
        body: JSON.stringify(buildPayload(items)),
      });
       message.success('Fatura kaydedildi');
      setInvoiceNo("VL" + Date.now().toString().slice(-8));
    } catch (err: any) {
      showError('Kayıt hatası', err);
    }
   

  };

  /* =========================================================
     3) Kaydet + PDF indir
  ========================================================= */
  const saveAndDownloadPdf = async () => {
    try {
      const res = await apiFetch('http://localhost:8080/api/invoices/save-and-pdf', {
        method: 'POST',
        body: JSON.stringify(buildPayload(items)),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fatura_${invoiceNo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('PDF indirildi');
    } catch (err: any) {
      showError('PDF oluşturma hatası', err);
    }
  };

  /* -------- Yardımcılar -------- */
  const buildPayload = (its: InvoiceItem[]) => ({
    ...company,
    invoiceNo,
    date: invoiceDate.format('YYYY-MM-DD'),
    totalAmount: totalDue.toFixed(2),
    items: its.map((it) => ({
      description: it.description,
      unitPrice: it.unitPrice.toFixed(2),
      quantity: String(it.quantity),
    })),
  });
  const showError = (title: string, err: any) =>
    notification.error({
      message: title,
      description:
        (err?.status ? `HTTP ${err.status}. ` : '') + (err?.bodyText || err?.message || 'Bilinmeyen hata'),
    });

  /* -------- Tablo kolonları -------- */
  const columns: ColumnsType<InvoiceItem> = [
    { title: '#', dataIndex: 'key', width: 60, render: (_v, _r, i) => i + 1 },
    { title: 'Ürün / Hizmet', dataIndex: 'description' },
    {
      title: 'Birim',
      dataIndex: 'unitPrice',
      align: 'right',
      render: (v: number) => fmtCurrency(v),
    },
    { title: 'Adet', dataIndex: 'quantity', align: 'right' },
    {
      title: 'Ara Toplam',
      align: 'right',
      render: (_, r) => <Text strong>{fmtCurrency(r.unitPrice * r.quantity)}</Text>,
    },
    {
      title: 'Aksiyon',
      key: 'act',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditItem(r)}>
            Düzenle
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() =>
              Modal.confirm({
                title: 'Kalemi sil',
                content: `"${r.description}" silinsin mi?`,
                okType: 'danger',
                onOk: () => setItems((prev) => prev.filter((it) => it.key !== r.key)),
              })
            }
          >
            Sil
          </Button>
        </Space>
      ),
    },
  ];

  /* =========================================================
     Render
  ========================================================= */
  return (
    <div className="min-h-[80vh] p-4">
      <Row gutter={[16, 16]}>
        {/* Üst butonlar */}
        <Col span={24}>
          <Space className="w-full justify-between">
            <div>
              <Title level={3}>Fatura</Title>
              <Text type="secondary">Önizleme, yazdırma ve PDF oluşturma</Text>
            </div>
            <Space.Compact>
              <Button icon={<PrinterOutlined />} onClick={handlePrint}>
                Yazdır
              </Button>
              <Button icon={<DownloadOutlined />} onClick={saveAndDownloadPdf}>
                PDF Kaydet & İndir
              </Button>
              <Button icon={<SaveOutlined />} type="primary" onClick={handleSaveInvoice}>
                Faturayı Kaydet
              </Button>
              <Button onClick={openCompany}>Firma Bilgileri</Button>
            </Space.Compact>
          </Space>
        </Col>

        {/* Baskı alanı */}
        <Col span={24}>
          <Card className="rounded-2xl">
            <div ref={printRef} className="p-6">
              {/* Fatura meta */}
              <Row gutter={[16, 16]} className="mb-4">
                <Col xs={24} md={6}>
                  <Card size="small">
                    <Text type="secondary">Tarih</Text>
                    <div>{invoiceDate.format('DD MMM, YYYY')}</div>
                  </Card>
                </Col>
                <Col xs={24} md={6}>
                  <Card size="small">
                    <Text type="secondary">Fatura No</Text>
                    <div>#{invoiceNo}</div>
                  </Card>
                </Col>
                <Col xs={24} md={6}>
                  <Card size="small">
                    <Text type="secondary">Hesap No</Text>
                    <div>{accountNo}</div>
                  </Card>
                </Col>
                <Col xs={24} md={6}>
                  <Card size="small">
                    <Text type="secondary">Toplam</Text>
                    <div>{fmtCurrency(totalDue)}</div>
                  </Card>
                </Col>
              </Row>

              {/* Kalemler */}
              <Button type="primary" icon={<PlusOutlined />} onClick={openAddItem}>
                Yeni Kalem
              </Button>
              <Table columns={columns} dataSource={items} pagination={false} className="mt-3" />

              {/* Toplamlar */}
              <Divider />
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Ara Toplam">
                  <Tag>{fmtCurrency(subtotal)}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="KDV">
                  <Tag color="processing">{fmtCurrency(vat)}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="İndirim">
                  <Tag>-{fmtCurrency(discount)}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={<Text strong>GENEL TOPLAM</Text>}>
                  <span className="px-3 py-1 rounded text-white" style={{ background: '#204492ff' }}>
                    {fmtCurrency(totalDue)}
                  </span>
                </Descriptions.Item>
              </Descriptions>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Modal: Kalem */}
      <Modal
        open={itemModalOpen}
        onCancel={() => setItemModalOpen(false)}
        title={editingKey ? 'Kalemi Düzenle' : 'Yeni Kalem'}
        okText={editingKey ? 'Güncelle' : 'Ekle'}
        onOk={saveItem}
        destroyOnClose
      >
        <Form form={itemForm} layout="vertical">
          <Form.Item label="Açıklama" name="description" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Birim Fiyat" name="unitPrice" rules={[{ required: true }]}>
                <InputNumber className="w-full" min={0} step={0.01} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Adet" name="quantity" rules={[{ required: true }]}>
                <InputNumber className="w-full" min={1} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal: Firma */}
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
