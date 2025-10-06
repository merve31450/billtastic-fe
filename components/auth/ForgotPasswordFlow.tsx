/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────────────────────
// file: components/auth/ForgotPasswordFlow.tsx
// 3 adımlı şifre yenileme akışı — e-posta, kod, yeni şifre
//  • auth-service 200/202/502/429 durumlarını doğru ele alır
//  • 202 (accepted) geldiğinde kullanıcıya “kısa süre içinde ulaşır” mesajı gösterir
//  • 429 yanıtındaki Retry-After başlığına göre yeniden gönderme butonunu bekletir
//  • correlation id (X-Correlation-Id) header’ını saklar (gerekirse debug/poll için)
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Form, Input, Steps, Typography, Space } from 'antd';
import { api } from '@/lib/api';

const { Paragraph, Text } = Typography;

export type ForgotPasswordFlowProps = {
  onBackToLogin?: (prefillEmail?: string) => void;
};

type ApiMessage = { message?: string } | undefined;

export default function ForgotPasswordFlow({ onBackToLogin }: ForgotPasswordFlowProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();

  // 0: email, 1: code, 2: reset
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // akış state
  const [email, setEmail] = useState<string>('');
  const [code, setCode] = useState<string>('');

  // yeniden gönderim bekleme sayacı (sn)
  const [resendLeft, setResendLeft] = useState<number>(0);

  // (opsiyonel) correlation id — sunucu header’ından gelir
  const [cid, setCid] = useState<string | null>(null);

  // sayacı azalt
  useEffect(() => {
    if (resendLeft <= 0) return;
    const t = setInterval(() => setResendLeft(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [resendLeft]);

  const steps = useMemo(
    () => [{ title: 'E-Posta' }, { title: 'Kod Doğrulama' }, { title: 'Yeni Şifre' }],
    []
  );

  // ---------------------------------------------------------------------------
  // 1) Kod gönder (status-aware)
  // ---------------------------------------------------------------------------
  const sendCode = async (targetEmail: string) => {
    setLoading(true);
    try {
      // 200 ve 202 success sayılır; 429/502 catch’e düşer (axios default)
      const res = await api.post<ApiMessage>('auth/password/forgot', { username: targetEmail });
      const correlationId =
        (res.headers as any)?.['x-correlation-id'] ?? (res.headers as any)?.['X-Correlation-Id'];
      if (correlationId) setCid(String(correlationId));

      setEmail(targetEmail);
      setStep(1);

      if (res.status === 200) {
        message.success(res.data?.message ?? 'Güvenlik kodu e-posta adresinize gönderildi.');
        setResendLeft(60); // sunucu 200 ise varsayılan bekleme
      } else if (res.status === 202) {
        message.info(
          res.data?.message ??
            'Kod gönderme işlemi başlatıldı. E-posta birkaç saniye içinde ulaşacaktır.'
        );
        setResendLeft(60);
      } else {
        // farklı 2xx gelmeyeceğini varsayıyoruz
        message.success('İstek alındı.');
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const retry = parseInt(err?.response?.headers?.['retry-after'] ?? '0', 10) || 0;
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Kod gönderilirken beklenmeyen bir hata oluştu.';

      if (status === 429) {
        // rate limit — muhtemelen daha önce kod gönderilmiş; kullanıcıyı kod ekranına alalım
        setEmail(targetEmail);
        setStep(1);
        if (retry > 0) setResendLeft(retry);
        message.warning(msg);
      } else if (status === 502) {
        message.error(msg); // mail-service gönderemedi
      } else {
        message.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // 2) Kod doğrula
const verifyCode = async () => {
    setLoading(true);
    try {
      const v = await form.validateFields(['f_code']);
      const c = v.f_code as string;

      await api.post<ApiMessage>('auth/password/verify', { username: email, code: c });

      setCode(c);
      setStep(2);
      message.success('Kod doğrulandı.');
    } catch (err: any) {
      const status = err?.response?.status as number | undefined;
      const serverMsg = err?.response?.data?.message as string | undefined;

      if ([400, 401, 403, 404, 410].includes(Number(status))) {
        const friendly =
          serverMsg && serverMsg.trim().length > 0
            ? serverMsg
            : status === 404 || status === 410
            ? 'Kod bulunamadı veya süresi doldu. Lütfen yeniden kod isteyin.'
            : 'Girdiğiniz güvenlik kodu hatalı.';

        // Alan altında hata göster
        form.setFields([{ name: 'f_code', errors: [friendly] }]);
        // Toast da göster
        message.error(friendly);
      } else {
        message.error(serverMsg ?? err?.message ?? 'Kod doğrulama hatası');
      }
    } finally {
      setLoading(false);
    }
  };


  // ---------------------------------------------------------------------------
  // 3) Yeni şifreyi kaydet
  // ---------------------------------------------------------------------------
  const resetPassword = async () => {
    setLoading(true);
    try {
      const v = await form.validateFields(['f_newPassword', 'f_newPassword2']);
      await api.post<ApiMessage>('auth/password/reset', {
        username: email,
        code,
        newPassword: v.f_newPassword,
      });
      message.success('Şifreniz güncellendi. Giriş ekranına yönlendiriliyorsunuz.');
      onBackToLogin?.(email);

      // local state sıfırla
      setStep(0);
      setEmail('');
      setCode('');
      setCid(null);
      setResendLeft(0);
      form.resetFields();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Şifre güncellenemedi';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div>
      <Paragraph style={{ marginTop: 0 }}>3 adımda şifrenizi sıfırlayın.</Paragraph>
      <Steps size="small" current={step} items={steps} style={{ marginBottom: 16 }} />

      {/* STEP 0: Email */}
      {step === 0 && (
        <Form form={form} layout="vertical" validateTrigger="onSubmit" initialValues={{ f_username: '' }}>
          <Form.Item
            label="E-Posta Adresi"
            name="f_username"
            rules={[
              { required: true, message: 'E-posta giriniz' },
              { type: 'email', message: 'Geçerli e-posta giriniz' },
            ]}
          >
            <Input placeholder="kullanici@ornek.com" autoComplete="username" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => onBackToLogin?.()}>← Girişe dön</Button>
            <Button
              type="primary"
              loading={loading}
              onClick={async () => {
                try {
                  const v = await form.validateFields(['f_username']);
                  await sendCode(v.f_username);
                } catch {
                  /* form invalid */
                }
              }}
            >
              {loading ? 'Kod Gönderiliyor...' : 'Kod Gönder'}
            </Button>
          </div>
        </Form>
      )}

      {/* STEP 1: Code */}
      {step === 1 && (
        <Form form={form} layout="vertical" validateTrigger="onSubmit">
          <Paragraph>
            <Text type="secondary">
              {email} adresine gönderilen 6 haneli güvenlik kodunu giriniz.
            </Text>
          </Paragraph>

          <Form.Item
            label="Güvenlik Kodu"
            name="f_code"
            rules={[
              { required: true, message: 'Kodu giriniz' },
              { len: 6, message: '6 haneli kod' },
              { pattern: /^\d{6}$/, message: 'Sadece rakam' },
            ]}
          >
            <Input
              maxLength={6}
              inputMode="numeric"
              placeholder="••••••"
              onPressEnter={verifyCode}
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => setStep(0)}>← Geri</Button>

            <Space>
              <Button
                disabled={loading || resendLeft > 0}
                onClick={() => sendCode(email)}
              >
                {resendLeft > 0 ? `Tekrar Gönder (${resendLeft}s)` : 'Kodu Yeniden Gönder'}
              </Button>

              <Button type="primary" loading={loading} onClick={verifyCode}>
                Doğrula
              </Button>
            </Space>
          </div>

          {/* küçük notlar */}
          <Paragraph type="secondary" style={{ marginTop: 12 }}>
            E-posta gelmediyse spam/junk klasörünü kontrol edin.
          </Paragraph>
        </Form>
      )}

      {/* STEP 2: New password */}
      {step === 2 && (
        <Form form={form} layout="vertical" validateTrigger="onSubmit">
          <Paragraph>
            <Text type="secondary">Yeni şifrenizi belirleyin.</Text>
          </Paragraph>

          <Form.Item
            label="Yeni Şifre"
            name="f_newPassword"
            rules={[
              { required: true, message: 'Şifre giriniz' },
              { min: 8, message: 'En az 8 karakter' },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          <Form.Item
            label="Yeni Şifre (Tekrar)"
            name="f_newPassword2"
            dependencies={['f_newPassword']}
            rules={[
              { required: true, message: 'Tekrar şifre giriniz' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('f_newPassword') === value) return Promise.resolve();
                  return Promise.reject(new Error('Şifreler eşleşmiyor'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => setStep(1)}>← Geri</Button>
            <Button type="primary" loading={loading} onClick={resetPassword}>
              Şifremi Kaydet
            </Button>
          </div>
        </Form>
      )}
    </div>
  );
}
