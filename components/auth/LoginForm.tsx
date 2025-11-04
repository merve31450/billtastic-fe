/* eslint-disable @typescript-eslint/no-explicit-any */
// file: components/auth/LoginForm.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Form, Input, Typography, Space, Card, Modal } from 'antd';
import { authApi, setAuthCookie } from '@/lib/api';
import { LoginFormValues, LoginResponse } from '@/lib/auth/client';
import ForgotPasswordFlow from './ForgotPasswordFlow';
import { useRouter, useSearchParams } from 'next/navigation';
import { decodeJwt } from '@/app/utils/jwt';

const { Text } = Typography;

type Mode = 'login' | 'register' | 'forgot';

/** FE base (X-Redirect-Base) — reverse proxy alt yolu dikkate alınır */
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
  const [form] = Form.useForm<LoginFormValues>();
  const [submitting, setSubmitting] = useState(false);

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

  // E-posta doğrulama dönüş mesajları
  useEffect(() => {
    const ec = searchParams?.get('emailConfirmed');
    if (ec === '1') {
      message.success('E-posta adresiniz doğrulandı. Şimdi giriş yapabilirsiniz.');
    } else if (ec === '0') {
      message.error('Doğrulama bağlantısı geçersiz veya süresi dolmuş.');
    }
  }, [searchParams, message]);

  useEffect(() => {
    if (loginPrefill) form.setFieldsValue({ username: loginPrefill });
  }, [loginPrefill, form]);

  // ---------------------------------------------------------------------------
  // LOGIN FORM
  // ---------------------------------------------------------------------------
  const submitLogin = async (values: LoginFormValues) => {
  setSubmitting(true);
  try {
    // 💚 backend DTO’ya uygun olacak şekilde email gönderiyoruz
    const { data } = await authApi.post<LoginResponse>('auth/login', {
      email: values.username,
      password: values.password,
    });

    const token = (data as any)?.token ?? (data as any)?.access_token ?? '';
    if (!token) throw new Error('Sunucu geçersiz yanıt döndürdü (token alınamadı).');

    const payload = decodeJwt<any>(token) || {};
    const userRole = payload?.role || payload?.roles?.[0] || 'user';

    try {
      const meRes = await authApi.get<any>('auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const me = meRes?.data ?? {};
      if (typeof me?.isMailConfirmed === 'boolean') {
      }
    } catch {
      // me düşerse JWT ile devam
    }

    // 🔥 Token’ı cookie’ye ve localStorage’a kaydet
    setAuthCookie(token, 1);
    localStorage.setItem("token", token.replace("Bearer ", ""));

    message.success('Giriş başarılı!');
    let defaultUrl = '/panel';
    if (userRole === 'admin') defaultUrl = '/admin/panel';
    if (userRole === 'expert') defaultUrl = '/expert/surveys';
    router.replace(nextUrl || defaultUrl);

  } catch (err: any) {
    const msg =
      err?.response?.data?.message ?? err?.message ?? 'Giriş sırasında bir hata oluştu.';
    message.error(msg);
  } finally {
    setSubmitting(false);
  }
};


  const LoginFields = (
    <Form
      form={form}
      layout="vertical"
      onFinish={submitLogin}
      onFinishFailed={() => message.error('Lütfen zorunlu alanları doldurun.')}
      validateTrigger="onSubmit"
      initialValues={{ username: loginPrefill ?? '', password: '' }}
    >
      <Form.Item
        label="E-Posta Adresi"
        name="username"
        rules={[
          { required: true, message: 'Lütfen e-posta adresinizi giriniz.' },
          { type: 'string' },
        ]}
      >
        <Input autoFocus placeholder="kullanici@ornek.com" autoComplete="username" />
      </Form.Item>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <Form.Item
          label="Şifre"
          name="password"
          style={{ flex: 1 }}
          rules={[{ required: true, message: 'Lütfen şifrenizi giriniz.' }]}
        >
          <Input.Password placeholder="••••••••" autoComplete="current-password" />
        </Form.Item>

        <Button
          type="link"
          onClick={() => setMode('forgot')}
          style={{ whiteSpace: 'nowrap', marginBottom: '0.75rem' }}
        >
          Şifremi Unuttum
        </Button>
      </div>

      <Form.Item style={{ marginTop: 16 }}>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          {submitting ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
        </Button>
      </Form.Item>
    </Form>
  );

  // ---------------------------------------------------------------------------
  // REGISTER FORM
  // ---------------------------------------------------------------------------
  const RegisterFields = (
    <Form
      layout="vertical"
      onFinish={async (values) => {
        try {
          const base = computeRedirectBase();
          await authApi.post(
            'auth/register',
            {
              name: values.name,
              surname: values.surname,
              email: values.email,
              password: values.password,
              role: 'USER',
            },
            { headers: { 'X-Redirect-Base': base } }
          );
          message.success('Kayıt işlemi başarılı! E-postanızı doğrulayın.');
          setMode('login');
        } catch (e: any) {
          const msg =
            e?.response?.data?.message || 'Kayıt işlemi başarısız. Lütfen tekrar deneyin.';
          message.error(msg);
        }
      }}
      onFinishFailed={() => message.error('Lütfen tüm zorunlu alanları doldurun.')}
    >
      <Form.Item
        label="Ad"
        name="name"
        rules={[{ required: true, message: 'Lütfen adınızı giriniz.' }]}
      >
        <Input placeholder="Adınız" />
      </Form.Item>

      <Form.Item
        label="Soyad"
        name="surname"
        rules={[{ required: true, message: 'Lütfen soyadınızı giriniz.' }]}
      >
        <Input placeholder="Soyadınız" />
      </Form.Item>

      <Form.Item
        label="E-Posta Adresi"
        name="email"
        rules={[
          { required: true, message: 'Lütfen e-posta adresinizi giriniz.' },
          { type: 'email', message: 'Geçerli bir e-posta adresi giriniz.' },
        ]}
      >
        <Input placeholder="kullanici@ornek.com" />
      </Form.Item>

      <Form.Item
        label="Şifre"
        name="password"
        rules={[{ required: true, message: 'Lütfen şifrenizi giriniz.' }]}
      >
        <Input.Password placeholder="••••••••" />
      </Form.Item>

      <Form.Item style={{ marginTop: 16 }}>
        <Button type="primary" htmlType="submit" block>
          Kayıt Ol
        </Button>
      </Form.Item>
    </Form>
  );

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
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
      styles={{
        body: { display: 'flex', flexDirection: 'column', height: '100%', padding: 16 },
      }}
    >
      <div style={{ marginBottom: 12 }} />

      {/* Sekmeler */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <Button
          type={mode === 'login' ? 'primary' : 'default'}
          size="large"
          block
          onClick={() => setMode('login')}
        >
          <strong>Giriş Yap</strong>
        </Button>
        <Button
          type={mode === 'register' ? 'primary' : 'default'}
          size="large"
          block
          onClick={() => setMode('register')}
        >
          <strong>Kayıt Ol</strong>
        </Button>
      </div>

      {/* İçerik */}
      <div id="auth-scroll-area" style={{ height: CONTENT_H, overflowY: 'auto', overflowX: 'hidden' }}>
        {mode === 'login' && LoginFields}
        {mode === 'register' && RegisterFields}
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