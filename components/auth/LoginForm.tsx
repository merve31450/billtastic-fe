/* eslint-disable @typescript-eslint/no-explicit-any */
// file: components/auth/LoginForm.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Divider, Form, Image, Input, Typography, Space, Card, Modal } from 'antd';
import { authApi, setAuthCookie } from '@/lib/api';
import { LoginFormValues, LoginResponse } from '@/lib/auth/client';
import ForgotPasswordFlow from './ForgotPasswordFlow';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { decodeJwt } from '@/app/utils/jwt';

const { Paragraph, Text } = Typography;

type Mode = 'login' | 'register' | 'forgot';



/** Kullanacağımız FE base (X-Redirect-Base) — reverse proxy alt yolu vs. dikkate alınır */
function computeRedirectBase(): string {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');
    return (origin + basePath) || origin || '';
  } catch {
    return '';
  }
}

export default function LoginForm() {
  const { message } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>('login');
  const [loginPrefill, setLoginPrefill] = useState<string | undefined>(undefined);

  // /login?next=... desteği
  const nextUrl = useMemo(() => {
    const raw = searchParams?.get('next') || '/panel';
    try {
      return decodeURIComponent(raw);
    } catch {
      return '/panel';
    }
  }, [searchParams]);

  // URL parametresi: mode & email
  useEffect(() => {
    const m = (searchParams?.get('mode') || '').toLowerCase();
    const e = searchParams?.get('email') || undefined;
    if (m === 'forgot' || m === 'register' || m === 'login') setMode(m as Mode);
    if (e) setLoginPrefill(e);
  }, [searchParams]);

  // E-posta doğrulama dönüş mesajları (?emailConfirmed=1/0)
  useEffect(() => {
    const ec = searchParams?.get('emailConfirmed');
    if (ec === '1') {
      message.success('E-posta adresiniz doğrulandı. Şimdi giriş yapabilirsiniz.');
    } else if (ec === '0') {
      message.error('Doğrulama bağlantısı geçersiz veya süresi dolmuş.');
    }
  }, [searchParams, message]);

  // ---------- LOGIN FORM STATE ----------
  const [form] = Form.useForm<LoginFormValues>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loginPrefill) form.setFieldsValue({ username: loginPrefill });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginPrefill]);

  const openResendModal = (emailFromForm?: string) => {
    const username = (emailFromForm || loginPrefill || form.getFieldValue('username') || '').trim();
    Modal.confirm({
      title: 'E-posta Doğrulaması Gerekli',
      content:
        'Kayıt işlemini tamamlamak için e-postanıza gelen aktivasyon bağlantısına tıklayın. İsterseniz aktivasyon e-postasını yeniden gönderebiliriz.',
      okText: 'Yeniden Gönder',
      cancelText: 'Kapat',
      onOk: async () => {
        try {
          const base = computeRedirectBase();
          await authApi.post(
            'auth/email/resend',
            { username },
            { headers: { 'X-Redirect-Base': base } }
          );
          message.success('Aktivasyon e-postası yeniden gönderildi.');
        } catch (e: any) {
          const msg = e?.response?.data?.message || 'E-posta gönderimi başarısız. Lütfen daha sonra tekrar deneyin.';
          message.error(msg);
        }
      },
    });
  };

  const submitLogin = async (values: LoginFormValues) => {
    setSubmitting(true);
    try {
      const { data } = await authApi.post<LoginResponse>('auth/login', values);
      const token = (data as any)?.token ?? (data as any)?.access_token ?? '';
      if (!token) throw new Error('Sunucu geçersiz yanıt döndürdü (token alınamadı).');

      // 1) JWT payload’dan hızlı çıkarımlar
      const payload = decodeJwt<any>(token) || {};
      const userRole = payload?.role || payload?.roles?.[0] || 'user';
      let isMailConfirmed: boolean | undefined =
        typeof payload?.mailConfirmed === 'boolean' ? payload.mailConfirmed : undefined;
      let isActive: boolean | undefined = undefined;

      // 2) Kesin durum için /auth/me
      try {
        const meRes = await authApi.get<any>('auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const me = meRes?.data ?? {};
        isActive = me?.isActive;
        if (typeof me?.isMailConfirmed === 'boolean') {
          isMailConfirmed = me.isMailConfirmed;
        }
      } catch {
        // me düşerse JWT ile devam
      }

      // 3) E-posta doğrulanmamışsa — güvenlik için ikinci bariyer (BE zaten 403 döndürüyor)
      if (!isMailConfirmed) {
        openResendModal(values.username);
        return;
      }

      // 4) Hesap pasif
      if (isActive === false) {
        Modal.error({
          title: 'Hesap Pasif',
          content:
            'Hesabınız şu anda pasif durumdadır. Bir hata olduğunu düşünüyorsanız info@aso.org.tr ile iletişime geçin.',
          okText: 'Tamam',
        });
        return;
      }


      // 6) Oturumu kur ve yönlendir
      setAuthCookie(token, 1);
      message.success('Giriş başarılı');
      let defaultUrl = '/panel';
      if (userRole === 'admin') defaultUrl = '/admin/panel';
      if (userRole === 'expert') defaultUrl = '/expert/surveys';
      router.replace(nextUrl || defaultUrl);
    } catch (err: any) {
      // Özel durum: MAIL_NOT_CONFIRMED (BE authenticate'ten ÖNCE döner)
      const code =
        err?.response?.data?.code ||
        err?.response?.headers?.['x-error-code'] ||
        err?.response?.headers?.['X-Error-Code'];
      if (code === 'MAIL_NOT_CONFIRMED') {
        openResendModal(form.getFieldValue('username'));
        setSubmitting(false);
        return;
      }

      // Genel hata akışı
      const msg =
        err?.response?.data?.message ?? err?.message ?? 'Giriş sırasında beklenmeyen bir hata oluştu.';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- RENDER HELPERS ----------
  const LoginFields = (
    <Form
      form={form}
      layout="vertical"
      onFinish={submitLogin}
      onFinishFailed={() => message.error('Lütfen zorunlu alanları eksiksiz doldurun.')}
      validateTrigger="onSubmit"
      initialValues={{ username: loginPrefill ?? '', password: '' }}
    >
      <Form.Item
        label="E-Posta Adresi"
        name="username"
        rules={[
          { required: true, message: 'Lütfen E-Posta Adresinizi Giriniz' },
          { type: 'string' },
        ]}
      >
        <Input autoFocus placeholder="kullanici@ornek.com" autoComplete="username" />
      </Form.Item>

      <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <Form.Item
          label="Şifre"
          name="password"
          style={{ flex: 1 }}
          rules={[{ required: true, message: 'Lütfen Şifrenizi giriniz' }]}
        >
          <Input.Password placeholder="••••••••" autoComplete="current-password" />
        </Form.Item>

        <Button
          type="link"
          onClick={() => setMode('forgot')}
          style={{ whiteSpace: 'nowrap', paddingBottom: 22,marginBottom:'0.75rem' }}
        >
          Şifremi Unuttum
        </Button>
      </div>

      <Form.Item style={{ marginTop: 16 }}>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          {submitting ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
        </Button>
      </Form.Item>

      <Divider plain>VEYA</Divider>
      <Paragraph style={{ textAlign: 'center', marginBottom: 8 }}>
        <Text type="secondary">E-Devlet ile Giriş Yap</Text>
      </Paragraph>

      <Button
        style={{
          width: '100%',
          padding: 8,
          minHeight: '5rem',
          maxHeight: '7rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Link href="https://turkiye.gov.tr" target="_blank" rel="noopener noreferrer">
          <Image
            src="edk-logo.png"
            alt="edk"
            preview={false}
            style={{
              maxWidth: '100%',
              maxHeight: 64,
              objectFit: 'contain',
              cursor: 'pointer',
            }}
          />
        </Link>
      </Button>
    </Form>
  );

  // Kart boyutları
  const CARD_MAX_W = 520;
  const CONTENT_H = 600;

  return (
    <Card
      style={{
        width: '100%',
        maxWidth: CARD_MAX_W,
        height: 'min(73vh, 640px)',
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
      }}
      styles={{ body: { display: 'flex', flexDirection: 'column', height: '100%', padding: 16 } }}
    >
      <div
        style={{
          width: '100%',
          background: 'transparent',
          borderRadius: 8,
          padding: '6px 10px',
          marginBottom: 12,
        }}
      />

      {/* Sekmeler */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <Button
          type={mode === 'login' ? 'primary' : 'default'}
          size="large"
          block
          onClick={() => setMode('login')}
          aria-pressed={mode === 'login'}
        >
          <strong>Giriş Yap</strong>
        </Button>
        <Button
          type={mode === 'register' ? 'primary' : 'default'}
          size="large"
          block
          onClick={() => setMode('register')}
          aria-pressed={mode === 'register'}
        >
          <strong>Kayıt Ol</strong>
        </Button>
      </div>

      {/* İçerik */}
      <div id="auth-scroll-area" style={{ height: CONTENT_H, overflowY: 'auto',overflowX:'hidden' }}>
        {mode === 'login' && LoginFields}

        {mode === 'forgot' && (
          <ForgotPasswordFlow
            onBackToLogin={(email) => {
              if (email) setLoginPrefill(email);
              setMode('login');
            }}
          />
        )}
      </div>

      {/* Alt bar */}
      {mode === 'forgot' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <Space>
            <Button onClick={() => setMode('login')}>Girişe dön</Button>
          </Space>
        </div>
      )}
    </Card>
  );
}
