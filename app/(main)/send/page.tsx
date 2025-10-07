'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Alert,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Dropdown,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Table,
  Tag,
  TimePicker,
  Typography,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  UploadOutlined,
  SendOutlined,
  SaveOutlined,
  ClockCircleOutlined,
  InboxOutlined,
  PlusOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  EditOutlined,
  DeleteOutlined,
  UserAddOutlined,
  ContactsOutlined,
  SearchOutlined,
  FileExcelOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text } = Typography;
const { Dragger } = Upload;

/* =========================
          Types
========================= */
type AlertKind = 'success' | 'info' | 'warning' | 'error';

interface AlertState {
  show: boolean;
  type: AlertKind;
  message: string;
}

interface EmailContact {
  id?: number;
  name: string;
  email: string;
  description?: string;
}

interface BulkEmailData {
  key?: React.Key;
  rowNumber: number;
  companyName: string;
  email: string;
  subject: string;
  body: string;
  selected: boolean;
  status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
  errorMessage?: string;
}

interface BulkStats {
  total: number;
  selected: number;
  sent: number;
  failed: number;
  pending: number;
}

/* =========================
        Helpers
========================= */
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Bilinmeyen bir hata oluştu';
};

function isFutureSchedule(date?: Dayjs | null, time?: Dayjs | null) {
  if (!date || !time) return false;
  const scheduled = date
    .hour(time.hour())
    .minute(time.minute())
    .second(0)
    .millisecond(0);
  return scheduled.isAfter(dayjs());
}

function toDateString(d?: Dayjs | null) {
  return d ? d.format('YYYY-MM-DD') : '';
}
function toTimeString(t?: Dayjs | null) {
  return t ? t.format('HH:mm') : '';
}

/* =========================
        Component
========================= */
export default function MailPanelPage() {
  const { message } = App.useApp();

  /* ----------- Form State ----------- */
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachment, setAttachment] = useState<UploadFile | null>(null);

  /* ----------- Contacts ----------- */
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [showContactList, setShowContactList] = useState(false);

  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EmailContact | null>(null);
  const [contactForm] = Form.useForm<EmailContact>();

  /* ----------- Bulk Email ----------- */
  const [csvFile, setCsvFile] = useState<UploadFile | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);

  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkEmailData[]>([]);
  const [bulkStats, setBulkStats] = useState<BulkStats | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkSelectedRowKeys, setBulkSelectedRowKeys] = useState<React.Key[]>([]);

  /* ----------- Scheduling ----------- */
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Dayjs | null>(null);
  const [scheduledTime, setScheduledTime] = useState<Dayjs | null>(null);

  /* ----------- Export ----------- */
  const [exportStart, setExportStart] = useState<Dayjs | null>(null);
  const [exportEnd, setExportEnd] = useState<Dayjs | null>(null);
  const [mailCount, setMailCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  /* ----------- UI ----------- */
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState>({ show: false, type: 'info', message: '' });

  /* =========================
         Alerts (inline)
  ========================= */
  const showAlert = (type: AlertKind, messageText: string) => {
    setAlert({ show: true, type, message: messageText });
    window.setTimeout(() => setAlert({ show: false, type, message: '' }), 5000);
  };

  /* =========================
         Contacts (CRUD)
  ========================= */
  const fetchContacts = async () => {
    setContactsLoading(true);
    try {
      const res = await fetch('http://localhost:8080/api/email-contacts');
      if (!res.ok) throw new Error('Kontaklar yüklenemedi');
      const data: EmailContact[] = await res.json();
      setContacts(data);
    } catch (e) {
      showAlert('error', `Kontaklar yüklenemedi: ${getErrorMessage(e)}`);
    } finally {
      setContactsLoading(false);
    }
  };

  const searchContacts = async (keyword: string) => {
    if (!keyword.trim()) {
      fetchContacts();
      return;
    }
    setContactsLoading(true);
    try {
      const res = await fetch(
        `http://localhost:8080/api/email-contacts/search?keyword=${encodeURIComponent(keyword)}`
      );
      if (!res.ok) throw new Error('Arama yapılamadı');
      const data: EmailContact[] = await res.json();
      setContacts(data);
    } catch (e) {
      showAlert('error', `Arama yapılamadı: ${getErrorMessage(e)}`);
    } finally {
      setContactsLoading(false);
    }
  };

  const openContactModal = (c?: EmailContact) => {
    setEditingContact(c ?? null);
    contactForm.setFieldsValue(c ?? { name: '', email: '', description: '' });
    setContactModalOpen(true);
  };

  const deleteContact = async (id?: number) => {
    if (!id) return;
    Modal.confirm({
      title: 'Kontağı sil',
      content: 'Bu kontağı silmek istediğinize emin misiniz?',
      okType: 'danger',
      onOk: async () => {
        try {
          const res = await fetch(`http://localhost:8080/api/email-contacts/${id}`, {
            method: 'DELETE',
          });
          if (!res.ok) throw new Error('Kontak silinemedi');
          message.success('Kontak silindi');
          fetchContacts();
        } catch (e) {
          showAlert('error', `Kontak silinemedi: ${getErrorMessage(e)}`);
        }
      },
    });
  };

  const saveContact = async (values: EmailContact) => {
    try {
      const url = editingContact
        ? `http://localhost:8080/api/email-contacts/${editingContact.id}`
        : 'http://localhost:8080/api/email-contacts';
      const method = editingContact ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t);
      }
      message.success(editingContact ? 'Kontak güncellendi' : 'Kontak eklendi');
      setContactModalOpen(false);
      setEditingContact(null);
      contactForm.resetFields();
      fetchContacts();
    } catch (e) {
      showAlert('error', `Kontak kaydedilemedi: ${getErrorMessage(e)}`);
    }
  };

  const contactMenuItems = contacts.slice(0, 10).map((c) => ({
    key: String(c.id ?? c.email),
    label: (
      <div onClick={() => selectContactEmail(c)}>
        <strong>{c.name}</strong>
        <br />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {c.email}
        </Text>
      </div>
    ),
  }));

  const selectContactEmail = (c: EmailContact) => {
    setEmail(c.email);
    message.success(`${c.name} (${c.email}) seçildi`);
  };

  /* =========================
        Bulk Email (CSV)
  ========================= */
  const updateBulkStats = (rows: BulkEmailData[]) => {
    const stats: BulkStats = {
      total: rows.length,
      selected: rows.filter((r) => r.selected).length,
      sent: rows.filter((r) => r.status === 'SENT').length,
      failed: rows.filter((r) => r.status === 'FAILED').length,
      pending: rows.filter((r) => r.status === 'PENDING' && r.selected).length,
    };
    setBulkStats(stats);
  };

  const handleCsvUpload = async () => {
    if (!csvFile?.originFileObj) {
      showAlert('error', 'Lütfen CSV dosyası seçin!');
      return;
    }
    setBulkUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', csvFile.originFileObj);

      const res = await fetch('http://localhost:8080/api/mail/upload-csv', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t);
      }
      const result = await res.json();
      const rows: BulkEmailData[] = (result.emails || []).map((r: BulkEmailData, i: number) => ({
        ...r,
        key: r.rowNumber ?? i + 1,
      }));
      setBulkRows(rows);
      updateBulkStats(rows);
      setBulkModalOpen(true);
      showAlert('success', `CSV yüklendi. ${result.stats?.total ?? rows.length} email bulundu.`);
    } catch (e) {
      showAlert('error', `CSV yüklenemedi: ${getErrorMessage(e)}`);
    } finally {
      setBulkUploading(false);
    }
  };

  const bulkColumns: ColumnsType<BulkEmailData> = [
    { title: '#', dataIndex: 'rowNumber', width: 70 },
    { title: 'Firma', dataIndex: 'companyName', render: (v) => <strong>{v || '-'}</strong> },
    {
      title: 'Email',
      dataIndex: 'email',
      render: (v) => <Text className="text-primary">{v}</Text>,
    },
    { title: 'Konu', dataIndex: 'subject', ellipsis: true },
    {
      title: 'Durum',
      dataIndex: 'status',
      width: 140,
      render: (status: BulkEmailData['status'], row) => (
        <Space direction="vertical" size={2}>
          {status === 'SENT' && <Tag color="success">Gönderildi</Tag>}
          {status === 'FAILED' && <Tag color="error">Başarısız</Tag>}
          {status === 'SENDING' && <Tag color="warning">Gönderiliyor</Tag>}
          {status === 'PENDING' && <Tag>Bekliyor</Tag>}
          {row.errorMessage && <Text type="danger" style={{ fontSize: 12 }}>{row.errorMessage}</Text>}
        </Space>
      ),
    },
  ];

  const bulkRowSelection = {
    selectedRowKeys: bulkSelectedRowKeys,
    onChange: (keys: React.Key[]) => {
      setBulkSelectedRowKeys(keys);
      const updated = bulkRows.map((r) => ({ ...r, selected: keys.includes(r.key as React.Key) }));
      setBulkRows(updated);
      updateBulkStats(updated);
    },
    getCheckboxProps: (record: BulkEmailData) => ({
      disabled: record.status === 'FAILED',
    }),
  };

  const toggleSelectAllBulk = (checked: boolean) => {
    const selectable = bulkRows.filter((r) => r.status !== 'FAILED');
    const keys = checked ? selectable.map((r) => r.key as React.Key) : [];
    setBulkSelectedRowKeys(keys);
    const updated = bulkRows.map((r) => ({ ...r, selected: keys.includes(r.key as React.Key) }));
    setBulkRows(updated);
    updateBulkStats(updated);
  };

  const sendBulk = async () => {
    if (!bulkStats || bulkStats.selected === 0) {
      showAlert('error', 'Gönderilecek email seçin!');
      return;
    }
    setBulkSending(true);
    try {
      const res = await fetch('http://localhost:8080/api/mail/send-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bulkRows),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t);
      }
      const result = await res.json();
      const rows: BulkEmailData[] = (result.results || []).map((r: BulkEmailData, i: number) => ({
        ...r,
        key: r.rowNumber ?? i + 1,
      }));
      setBulkRows(rows);
      updateBulkStats(rows);
      setBulkSelectedRowKeys(rows.filter((r) => r.selected).map((r) => r.key as React.Key));
      showAlert(
        'success',
        `Bulk gönderim tamamlandı. ${result.stats?.sent ?? 0} başarılı, ${result.stats?.failed ?? 0} başarısız.`
      );
    } catch (e) {
      showAlert('error', `Bulk email gönderilemedi: ${getErrorMessage(e)}`);
    } finally {
      setBulkSending(false);
    }
  };

  /* =========================
        Send (single)
  ========================= */
  const validateForm = () => {
    if (!email) return showAlert('error', 'Alıcı email adresini girin!'), false;
    if (!subject) return showAlert('error', 'Email konusunu girin!'), false;
    if (!body && !attachment) return showAlert('error', 'Mesaj yazın veya dosya ekleyin!'), false;
    if (isScheduled && (!scheduledDate || !scheduledTime))
      return showAlert('error', 'Zamanlanmış gönderim için tarih ve saat seçin!'), false;
    if (isScheduled && !isFutureSchedule(scheduledDate, scheduledTime))
      return showAlert('error', 'Zamanlanmış gönderim gelecekte bir an olmalı!'), false;
    return true;
  };

  const clearForm = () => {
    setEmail('');
    setSubject('');
    setBody('');
    setAttachment(null);
    setIsScheduled(false);
    setScheduledDate(null);
    setScheduledTime(null);
    showAlert('info', 'Form temizlendi');
  };

  const sendMail = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const payload = {
        to: email,
        subject,
        body,
        isScheduled,
        scheduledDate: isScheduled ? toDateString(scheduledDate) : null,
        scheduledTime: isScheduled ? toTimeString(scheduledTime) : null,
        timestamp: new Date().toISOString(),
      };

      // Dosya VARSA multipart, YOKSA JSON
      if (attachment?.originFileObj) {
        const fd = new FormData();
        fd.append('to', payload.to);
        fd.append('subject', payload.subject);
        fd.append('body', payload.body);
        fd.append('isScheduled', String(payload.isScheduled));
        if (payload.isScheduled) {
          fd.append('scheduledDate', payload.scheduledDate || '');
          fd.append('scheduledTime', payload.scheduledTime || '');
        }
        fd.append('file', attachment.originFileObj);

        const res = await fetch('http://localhost:8080/api/mail/send-attachment', {
          method: 'POST',
          body: fd,
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(`HTTP ${res.status} - ${t}`);
        }
        message.success(await res.text());
        if (!isScheduled) clearForm();
      } else {
        const res = await fetch('http://localhost:8080/api/mail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(`HTTP ${res.status} - ${t}`);
        }
        message.success(await res.text());
        if (!isScheduled) clearForm();
      }
    } catch (e) {
      showAlert('error', `Email gönderilemedi: ${getErrorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  };

  /* =========================
        Export (CSV)
  ========================= */
  const getMailCount = async () => {
    if (!exportStart || !exportEnd)
      return showAlert('error', 'Başlangıç ve bitiş tarihi seçin!');
    if (exportStart.isAfter(exportEnd))
      return showAlert('error', 'Başlangıç tarihi, bitiş tarihinden sonra olamaz!');

    setCountLoading(true);
    try {
      const res = await fetch('http://localhost:8080/api/mail/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: toDateString(exportStart),
          endDate: toDateString(exportEnd),
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t);
      }
      const count = await res.json();
      setMailCount(count);
      if (count === 0) showAlert('warning', 'Seçilen aralıkta mail bulunamadı.');
      else showAlert('info', `${count} adet mail bulundu. İndirebilirsiniz.`);
    } catch (e) {
      setMailCount(null);
      showAlert('error', `Mail sayısı alınamadı: ${getErrorMessage(e)}`);
    } finally {
      setCountLoading(false);
    }
  };

  const exportMails = async () => {
    if (!exportStart || !exportEnd)
      return showAlert('error', 'Başlangıç ve bitiş tarihi seçin!');
    if (mailCount === null) return showAlert('warning', 'Önce mail sayısını kontrol edin!');
    if (mailCount === 0) return showAlert('warning', 'İndirilecek mail yok!');

    setExportLoading(true);
    try {
      const res = await fetch('http://localhost:8080/api/mail/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: toDateString(exportStart),
          endDate: toDateString(exportEnd),
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mail_raporu_${toDateString(exportStart)}_${toDateString(exportEnd)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showAlert('success', `${mailCount} mail CSV olarak indirildi.`);
    } catch (e) {
      showAlert('error', `Export başarısız: ${getErrorMessage(e)}`);
    } finally {
      setExportLoading(false);
    }
  };

  /* =========================
        Effects
  ========================= */
  useEffect(() => {
    fetchContacts();
  }, []);

  // YENİ
useEffect(() => {
  const t = window.setTimeout(() => {
    searchContacts(contactSearch);
  }, 300);
  return () => window.clearTimeout(t);
}, [contactSearch]); // ← sadece contactSearch'a bağımlı


  /* =========================
        Memoized values
  ========================= */
  const canSend = useMemo(() => {
    const ok = !!email && !!subject && (!!body || !!attachment);
    const scheduleOk = !isScheduled || isFutureSchedule(scheduledDate, scheduledTime);
    return ok && scheduleOk && !loading;
  }, [email, subject, body, attachment, isScheduled, scheduledDate, scheduledTime, loading]);

  /* =========================
         Render
  ========================= */
  return (
    <div className="min-h-[80vh] p-4">
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Title level={3} className="!mb-1">Email Gönderme Paneli</Title>
          <Text type="secondary">Tekil veya CSV ile toplu mail gönderebilirsiniz.</Text>
        </Col>

        {alert.show && (
          <Col span={24}>
            <Alert
              type={alert.type}
              message={alert.message}
              showIcon
            />
          </Col>
        )}

        {/* ========== BULK (CSV) ========== */}
        <Col span={24}>
          <Card title={<Space><InboxOutlined /> Toplu Email Gönderimi (CSV)</Space>} className="rounded-2xl">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={16}>
                <Dragger
                  accept=".csv"
                  maxCount={1}
                  beforeUpload={() => false}
                  fileList={csvFile ? [csvFile] : []}
                  onChange={({ fileList }) => setCsvFile(fileList[0] ?? null)}
                >
                  <p className="ant-upload-drag-icon"><UploadOutlined /></p>
                  <p className="ant-upload-text">CSV dosyasını sürükleyin veya tıklayın</p>
                  <p className="ant-upload-hint">Format: Firma Adı, Email, Konu, İçerik</p>
                </Dragger>
              </Col>
              <Col xs={24} md={8} className="flex items-end">
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  size="large"
                  block
                  onClick={handleCsvUpload}
                  loading={bulkUploading}
                  disabled={!csvFile}
                >
                  CSV Yükle
                </Button>
              </Col>

              <Col span={24}>
                <Alert
                  type="info"
                  showIcon
                  message="CSV Dosya Örneği"
                  description={
                    <code className="block p-3 rounded bg-white">
                      Firma Adı,Email,Konu,İçerik<br />
                      ABC Şirketi,info@abc.com,Ürün Tanıtımı, Yeni ürünlerimizi tanıtmak istiyoruz<br />
                      XYZ Ltd,test@xyz.com,Toplantı Daveti, Gelecek hafta toplantımız var
                    </code>
                  }
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* ========== CONTACTS ========== */}
        <Col span={24}>
          <Card
            className="rounded-2xl"
            title={<Space><ContactsOutlined /> Email Kontakları</Space>}
            extra={
              <Space>
                <Button icon={<PlusOutlined />} onClick={() => openContactModal()} type="primary" size="small">
                  Yeni Kontak
                </Button>
                <Button
                  icon={showContactList ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                  onClick={() => setShowContactList((v) => !v)}
                  size="small"
                >
                  {showContactList ? 'Gizle' : 'Göster'}
                </Button>
              </Space>
            }
          >
            {showContactList && (
              <>
                <Row gutter={[12, 12]} className="mb-3">
                  <Col xs={24} md={12}>
                    <Input
                      prefix={<SearchOutlined />}
                      placeholder="Kontak ara (isim veya email)…"
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      allowClear
                    />
                  </Col>
                  <Col xs={24} md={12} className="flex items-center">
                    <Badge count={contacts.length} color="#999" />
                    <Text className="ml-2">Toplam kontak</Text>
                  </Col>
                </Row>

                <Table<EmailContact>
                  rowKey={(r) => String(r.id ?? r.email)}
                  loading={contactsLoading}
                  dataSource={contacts}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    { title: 'İsim', dataIndex: 'name', render: (v) => <strong>{v}</strong> },
                    { title: 'Email', dataIndex: 'email', render: (v) => <Text className="text-primary">{v}</Text> },
                    {
                      title: 'Açıklama',
                      dataIndex: 'description',
                      render: (v) => <Text type="secondary">{v || '-'}</Text>,
                    },
                    {
                      title: 'İşlemler',
                      key: 'actions',
                      width: 200,
                      render: (_, r) => (
                        <Space>
                          <Button size="small" type="primary" onClick={() => selectContactEmail(r)}>
                            Kullan
                          </Button>
                          <Button size="small" icon={<EditOutlined />} onClick={() => openContactModal(r)}>
                            Düzenle
                          </Button>
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => deleteContact(r.id)}
                          >
                            Sil
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              </>
            )}
          </Card>
        </Col>

        {/* ========== SEND MAIL FORM ========== */}
        <Col span={24}>
          <Card className="rounded-2xl" title={<Space><SendOutlined /> Yeni Email Gönder</Space>}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Alıcı email adresi"
                    type="email"
                  />
                  <Dropdown
                    menu={{ items: contactMenuItems }}
                    placement="bottomRight"
                    trigger={['click']}
                  >
                    <Button icon={<ContactsOutlined />} />
                  </Dropdown>
                </Space.Compact>
              </Col>
              <Col xs={24} md={12}>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Konu"
                />
              </Col>

              <Col span={24}>
                <Input.TextArea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  placeholder="Mesajınızı yazın…"
                  allowClear
                />
              </Col>

              <Col span={24}>
                <Upload
                  beforeUpload={() => false}
                  maxCount={1}
                  onChange={({ fileList }) => setAttachment(fileList[0] ?? null)}
                  fileList={attachment ? [attachment] : []}
                >
                  <Button icon={<UploadOutlined />}>Dosya Ekle (opsiyonel)</Button>
                </Upload>
                <Text type="secondary" className="ml-2">Maksimum 10MB</Text>
              </Col>

              <Col span={24}>
                <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50">
                  <Space direction="vertical" className="w-full">
                    <Space align="center">
                      <ClockCircleOutlined />
                      <Text strong>Zamanlanmış Gönderim</Text>
                    </Space>
                    <Row gutter={[12, 12]}>
                      <Col xs={24} md={6}>
                        <Form.Item className="!mb-0">
                          <Button
                            type={isScheduled ? 'primary' : 'default'}
                            onClick={() => setIsScheduled((v) => !v)}
                          >
                            {isScheduled ? 'Aktif' : 'Pasif'}
                          </Button>
                        </Form.Item>
                      </Col>
                      {isScheduled && (
                        <>
                          <Col xs={24} md={9}>
                            <DatePicker
                              className="w-full"
                              placeholder="Gönderim tarihi"
                              value={scheduledDate}
                              onChange={(d) => setScheduledDate(d)}
                              disabledDate={(d) => d && d.startOf('day').isBefore(dayjs().startOf('day'))}
                            />
                          </Col>
                          <Col xs={24} md={9}>
                            <TimePicker
                              className="w-full"
                              placeholder="Gönderim saati"
                              value={scheduledTime}
                              onChange={(t) => setScheduledTime(t)}
                              format="HH:mm"
                            />
                          </Col>
                        </>
                      )}
                    </Row>
                  </Space>
                </div>
              </Col>

              <Col xs={24} md={8}>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  size="large"
                  block
                  onClick={sendMail}
                  loading={loading}
                  disabled={!canSend}
                >
                  {isScheduled ? 'Zamanla' : 'Anında Gönder'}
                </Button>
              </Col>
              <Col xs={24} md={8}>
                <Button
                  icon={<SaveOutlined />}
                  size="large"
                  block
                  onClick={() => showAlert('info', 'Taslak kaydedildi!')}
                  disabled={loading}
                >
                  Taslak Kaydet
                </Button>
              </Col>
              <Col xs={24} md={8}>
                <Button size="large" block onClick={clearForm} disabled={loading}>
                  Temizle
                </Button>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* ========== EXPORT ========== */}
        <Col span={24}>
          <Card className="rounded-2xl" title={<Space><FileExcelOutlined /> Mail Geçmişi Export</Space>}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <DatePicker
                  className="w-full"
                  placeholder="Başlangıç tarihi"
                  value={exportStart}
                  onChange={(d) => {
                    setExportStart(d);
                    setMailCount(null);
                  }}
                  disabledDate={(d) => d && d.isAfter(dayjs())}
                />
              </Col>
              <Col xs={24} md={8}>
                <DatePicker
                  className="w-full"
                  placeholder="Bitiş tarihi"
                  value={exportEnd}
                  onChange={(d) => {
                    setExportEnd(d);
                    setMailCount(null);
                  }}
                  disabledDate={(d) => d && d.isAfter(dayjs())}
                />
              </Col>
              <Col xs={24} md={8} className="flex items-center">
                {mailCount !== null ? (
                  <Badge
                    count={`${mailCount} adet mail`}
                    style={{ backgroundColor: '#1677ff' }}
                  />
                ) : (
                  <Text type="secondary">Henüz kontrol edilmedi</Text>
                )}
              </Col>

              <Col xs={24} md={12}>
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  size="large"
                  block
                  onClick={getMailCount}
                  loading={countLoading}
                  disabled={!exportStart || !exportEnd}
                >
                  Mail Sayısını Kontrol Et
                </Button>
              </Col>
              <Col xs={24} md={12}>
                <Button
                  type="default"
                  icon={<DownloadOutlined />}
                  size="large"
                  block
                  onClick={exportMails}
                  loading={exportLoading}
                  disabled={mailCount === null || mailCount === 0}
                >
                  CSV Olarak İndir
                </Button>
              </Col>

              <Col span={24}>
                <Alert
                  type="success"
                  showIcon
                  message="Export Bilgileri"
                  description={
                    <ul className="mb-0">
                      <li><strong>CSV Format:</strong> Excel’de açılabilir</li>
                      <li><strong>İçerik:</strong> Gönderen, alıcı, konu, tarih, durum, ekler</li>
                      <li><strong>Karakter:</strong> Türkçe karakter destekli</li>
                      <li><strong>Dosya Adı:</strong> mail_raporu_başlangıç_bitiş.csv</li>
                    </ul>
                  }
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* ========== BULK MODAL ========== */}
      <Modal
        open={bulkModalOpen}
        onCancel={() => setBulkModalOpen(false)}
        width={1000}
        title="Toplu Email Gönderimi - Önizleme"
        footer={[
          <Button key="close" onClick={() => setBulkModalOpen(false)}>Kapat</Button>,
          <Button
            key="send"
            type="primary"
            onClick={sendBulk}
            loading={bulkSending}
            disabled={!bulkStats || bulkStats.selected === 0}
          >
            {bulkSending ? 'Gönderiliyor…' : `Seçili Email’leri Gönder (${bulkStats?.selected || 0})`}
          </Button>,
        ]}
      >
        {bulkStats && (
          <Row gutter={[12, 12]} className="mb-3">
            <Col span={6}><Tag>Toplam: {bulkStats.total}</Tag></Col>
            <Col span={6}><Tag color="processing">Seçili: {bulkStats.selected}</Tag></Col>
            <Col span={6}><Tag color="success">Gönderilen: {bulkStats.sent}</Tag></Col>
            <Col span={6}><Tag color="error">Başarısız: {bulkStats.failed}</Tag></Col>
          </Row>
        )}
        <div className="mb-3">
          <Space>
            <Button onClick={() => toggleSelectAllBulk(true)}>Tümünü Seç</Button>
            <Button onClick={() => toggleSelectAllBulk(false)}>Seçimi Kaldır</Button>
          </Space>
        </div>
        <Table<BulkEmailData>
          rowSelection={bulkRowSelection}
          columns={bulkColumns}
          dataSource={bulkRows}
          pagination={{ pageSize: 8 }}
          scroll={{ x: true }}
        />
      </Modal>

      {/* ========== CONTACT MODAL ========== */}
      <Modal
        open={contactModalOpen}
        onCancel={() => setContactModalOpen(false)}
        title={editingContact ? 'Kontak Düzenle' : 'Yeni Kontak Ekle'}
        onOk={() => contactForm.submit()}
        okText={editingContact ? 'Güncelle' : 'Kaydet'}
      >
        <Form form={contactForm} layout="vertical" onFinish={saveContact}>
          <Form.Item name="name" label="İsim/Firma Adı" rules={[{ required: true, message: 'Zorunlu alan' }]}>
            <Input prefix={<UserAddOutlined />} placeholder="Kişi veya firma adı" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email Adresi"
            rules={[
              { required: true, message: 'Zorunlu alan' },
              { type: 'email', message: 'Geçerli bir email girin' },
            ]}
          >
            <Input placeholder="ornek@email.com" />
          </Form.Item>
          <Form.Item name="description" label="Açıklama / Not (opsiyonel)">
            <Input.TextArea rows={3} placeholder="Bu kontak hakkında not…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
