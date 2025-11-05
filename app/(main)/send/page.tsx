'use client';

import React, { useMemo, useState } from 'react';
import {
  App,
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Row,
  Space,
  TimePicker,
  Typography,
  Upload,
  Radio,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { UploadOutlined, SendOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text } = Typography;

/* =========================
   Helper Function (token’lı fetch)
========================= */
async function apiFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    ...(options.headers || {}),
    Authorization: token ? `Bearer ${token}` : '',
  };
  return fetch(url, { ...options, headers });
}

/* =========================
         Utilities
========================= */
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Bilinmeyen bir hata oluştu';
};
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

  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachment, setAttachment] = useState<UploadFile | null>(null);

  const [sendMode, setSendMode] = useState<'instant' | 'scheduled'>('instant');
  const [scheduledDate, setScheduledDate] = useState<Dayjs | null>(null);
  const [scheduledTime, setScheduledTime] = useState<Dayjs | null>(null);

  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ show: boolean; type: 'success' | 'error'; message: string }>({
    show: false,
    type: 'success',
    message: '',
  });

  const showAlert = (type: 'success' | 'error', msg: string) => {
    setAlert({ show: true, type, message: msg });
    window.setTimeout(() => setAlert({ show: false, type, message: '' }), 4000);
  };

  /* =========================
         Send Mail
  ========================= */
  const sendMail = async () => {
    // ✅ Email format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!email) return showAlert('error', 'Lütfen e-posta adresinizi girin!');
    if (!emailRegex.test(email)) return showAlert('error', 'Geçerli bir e-posta adresi giriniz!');
    if (!subject) return showAlert('error', 'Lütfen konu alanını doldurun!');
    if (!body) return showAlert('error', 'Mesaj içeriğini yazın!');
    if (sendMode === 'scheduled' && (!scheduledDate || !scheduledTime)) {
      return showAlert('error', 'Tarihli gönderim için tarih ve saat seçiniz!');
    }

    setLoading(true);
    try {
      const date = sendMode === 'scheduled' ? toDateString(scheduledDate) : toDateString(dayjs());
      const time = sendMode === 'scheduled' ? toTimeString(scheduledTime) : toTimeString(dayjs());

      // Eğer dosya varsa FormData gönder
      if (attachment?.originFileObj) {
        const fd = new FormData();
        fd.append('to', email);
        fd.append('subject', subject);
        fd.append('body', body);
        fd.append('file', attachment.originFileObj);
        fd.append('date', date);
        fd.append('time', time);

        const res = await apiFetch('http://localhost:8080/api/mail/send-attachment', {
          method: 'POST',
          body: fd,
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const mailRequest = {
          email: email,
          password: subject,
          repeatPassword: subject,
          date,
          time,
        };

        const res = await apiFetch('http://localhost:8080/api/mail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mailRequest),
        });
        if (!res.ok) throw new Error(await res.text());
      }

      message.success('Mail başarıyla gönderildi!');
      setEmail('');
      setSubject('');
      setBody('');
      setAttachment(null);
      setScheduledDate(null);
      setScheduledTime(null);
      setSendMode('instant');
    } catch (e) {
      showAlert('error', `Mail gönderilemedi: ${getErrorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     Gönder butonunu aktif/pasif yap
  ========================= */
  const canSend = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (loading) return false;
    if (!email || !emailRegex.test(email) || !subject || !body) return false;
    if (sendMode === 'scheduled' && (!scheduledDate || !scheduledTime)) return false;
    return true;
  }, [email, subject, body, sendMode, scheduledDate, scheduledTime, loading]);

  /* =========================
           Render
  ========================= */
  return (
    <div className="min-h-[80vh] p-4">
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Title level={3}>Email Gönderme Paneli</Title>
          <Text type="secondary">Tekil veya ekli dosya ile e-posta gönderebilirsiniz.</Text>
        </Col>

        {alert.show && (
          <Col span={24}>
            <Alert type={alert.type} message={alert.message} showIcon />
          </Col>
        )}

        <Col span={24}>
          <Card
            className="rounded-2xl"
            title={
              <Space>
                <SendOutlined /> Yeni Email Gönder
              </Space>
            }
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Alıcı e-posta adresi"
                  type="email"
                  allowClear
                  status={
                    email
                      ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
                        ? ''
                        : 'error'
                      : ''
                  }
                />
                {email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && (
                  <Text type="danger">Geçerli bir e-posta adresi giriniz.</Text>
                )}
              </Col>

              <Col xs={24} md={12}>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Konu"
                  allowClear
                />
              </Col>

              <Col span={24}>
                <Input.TextArea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  placeholder="Mesaj içeriği..."
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
                  <Button icon={<UploadOutlined />}>Dosya Ekle</Button>
                </Upload>
              </Col>

              <Col span={24}>
                <Radio.Group
                  onChange={(e) => setSendMode(e.target.value)}
                  value={sendMode}
                >
                  <Radio.Button value="instant">Anında Gönder</Radio.Button>
                  <Radio.Button value="scheduled">Tarihli Gönder</Radio.Button>
                </Radio.Group>
              </Col>

              {sendMode === 'scheduled' && (
                <>
                  <Col xs={24} md={8}>
                    <DatePicker
                      style={{ width: '100%' }}
                      placeholder="Tarih Seçin"
                      value={scheduledDate}
                      onChange={(d) => setScheduledDate(d)}
                    />
                  </Col>
                  <Col xs={24} md={8}>
                    <TimePicker
                      style={{ width: '100%' }}
                      placeholder="Saat Seçin"
                      format="HH:mm"
                      value={scheduledTime}
                      onChange={(t) => setScheduledTime(t)}
                    />
                  </Col>
                </>
              )}

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
                  {sendMode === 'scheduled' ? 'Zamanla Gönder' : 'Gönder'}
                </Button>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
