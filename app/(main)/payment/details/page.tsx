'use client';

import React, { useMemo, useState } from 'react';
import { Card, Form, Input, Row, Col, Button, App, Typography, Alert } from 'antd';
import Image from 'next/image';

const { Title, Text } = Typography;

type FormValues = {
  cardNumber: string;
  cardName: string;
  expiryDate: string; // AA/YY
  cvc: string;
};

function formatCardNumber(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(raw: string) {
  let digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length > 2) digits = `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function isFutureExpiry(mmYY: string) {
  // Beklenen format: AA/YY
  const m = /^(\d{2})\/(\d{2})$/.exec(mmYY);
  if (!m) return false;
  const month = Number(m[1]);
  const year2 = Number(m[2]);
  if (month < 1 || month > 12) return false;

  const now = new Date();
  // ayın ilk günü baz alınır, mevcut aya eşit/sonra olmalı
  const exp = new Date(2000 + year2, month - 1, 1);
  // geçerli sayılması için: exp >= (içinde bulunduğumuz ayın ilk günü)
  const cur = new Date(now.getFullYear(), now.getMonth(), 1);
  return exp >= cur;
}

function toIsoExpiry(mmYY: string) {
  // "12/27" -> "2027-12-01"
  const [mm, yy] = mmYY.split('/');
  return `20${yy}-${mm.padStart(2, '0')}-01`;
}

export default function PaymentDetailsPage() {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { message } = App.useApp();

  // Buton etkin/pasif mantığı
  const canSubmit = useMemo(() => {
    const { cardNumber, cardName, expiryDate, cvc } = form.getFieldsValue();
    const okNumber = (cardNumber || '').replace(/\s/g, '').length === 16;
    const okName = !!cardName && cardName.trim().length > 1;
    const okExpiry = !!expiryDate && /^\d{2}\/\d{2}$/.test(expiryDate) && isFutureExpiry(expiryDate);
    const okCvc = /^\d{3}$/.test(cvc || '');
    return okNumber && okName && okExpiry && okCvc && !loading;
  }, [form, loading]);

  const onValuesChange = (changed: Partial<FormValues>) => {
    if (changed.cardNumber !== undefined) {
      form.setFieldsValue({ cardNumber: formatCardNumber(changed.cardNumber) });
      setErr(null);
    }
    if (changed.expiryDate !== undefined) {
      form.setFieldsValue({ expiryDate: formatExpiry(changed.expiryDate) });
      setErr(null);
    }
    if (changed.cardName !== undefined) {
      // Sadece harf ve boşluk
      const clean = changed.cardName.replace(/[^a-zA-ZığüşöçİĞÜŞÖÇ\s]/g, '');
      form.setFieldsValue({ cardName: clean });
      setErr(null);
    }
    if (changed.cvc !== undefined) {
      const digits = changed.cvc.replace(/\D/g, '').slice(0, 3);
      form.setFieldsValue({ cvc: digits });
      setErr(null);
    }
  };

  const onFinish = async (values: FormValues) => {
    try {
      setLoading(true);
      setErr(null);

      if (!isFutureExpiry(values.expiryDate)) {
        throw new Error('Son kullanım tarihi geçmiş veya format hatalı (AA/YY).');
      }

      const payload = {
        amount: '100.0',
        currency: 'USD',
        transactionId: 'TRX12345',
        card: {
          cardNumber: values.cardNumber.replace(/\s/g, ''),
          cardHolderName: values.cardName,
          expiryDate: toIsoExpiry(values.expiryDate),
          cvc: values.cvc,
        },
      };

      // Axios instance kullanıyorsan:
      // await api.post('/payments', payload);
      const res = await fetch('http://localhost:8080/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data?.status === 'failed') {
        throw new Error(data?.message || 'Bir hata oluştu.');
      }

      message.success('Ödeme başarılı!');
      form.resetFields();
    } catch (e: unknown) {
      if (e instanceof Error) {
        setErr(e.message || 'Sunucu hatası oluştu.');
      } else if (typeof e === 'string') {
        setErr(e);
      } else {
        setErr('Sunucu hatası oluştu.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-5xl rounded-2xl shadow-xl">
        <div className="px-6 pt-6">
          <Title level={3} className="!mb-0">
            Ödeme Bilgileri
          </Title>
          <Text type="secondary">Kart bilgilerinizi güvenle girin.</Text>
        </div>

        <div className="p-6">
          {err && (
            <Alert
              className="mb-4"
              type="error"
              message="İşlem Başarısız"
              description={err}
              showIcon
            />
          )}

          <Row gutter={[24, 24]} align="middle">
            <Col xs={24} md={14}>
              <Form<FormValues>
                form={form}
                layout="vertical"
                onValuesChange={onValuesChange}
                onFinish={onFinish}
                requiredMark={false}
              >
                <Form.Item
                  label="Kart Numarası"
                  name="cardNumber"
                  rules={[
                    { required: true, message: 'Kart numarası zorunludur.' },
                    {
                      validator: (_, v) =>
                        v && v.replace(/\s/g, '').length === 16
                          ? Promise.resolve()
                          : Promise.reject(new Error('16 haneli kart numarası giriniz.')),
                    },
                  ]}
                >
                  <Input
                    placeholder="1234 5678 9012 3456"
                    maxLength={19} // 16 + 3 boşluk
                    inputMode="numeric"
                    autoComplete="cc-number"
                  />
                </Form.Item>

                <Form.Item
                  label="Karttaki İsim"
                  name="cardName"
                  rules={[{ required: true, message: 'İsim zorunludur.' }]}
                >
                  <Input placeholder="AD SOYAD" autoComplete="cc-name" />
                </Form.Item>

                <Row gutter={12}>
                  <Col xs={12}>
                    <Form.Item
                      label="Son Kullanım (AA/YY)"
                      name="expiryDate"
                      rules={[
                        { required: true, message: 'Son kullanım tarihi zorunludur.' },
                        {
                          validator: (_, v) =>
                            v && /^\d{2}\/\d{2}$/.test(v) && isFutureExpiry(v)
                              ? Promise.resolve()
                              : Promise.reject(
                                  new Error('Geçerli ve ileri tarih (AA/YY) giriniz.')
                                ),
                        },
                      ]}
                    >
                      <Input
                        placeholder="MM/YY"
                        maxLength={5}
                        inputMode="numeric"
                        autoComplete="cc-exp"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={12}>
                    <Form.Item
                      label="CVC"
                      name="cvc"
                      rules={[
                        { required: true, message: 'CVC zorunludur.' },
                        {
                          pattern: /^\d{3}$/,
                          message: 'CVC 3 haneli olmalıdır.',
                        },
                      ]}
                    >
                      <Input
                        placeholder="123"
                        maxLength={3}
                        inputMode="numeric"
                        autoComplete="cc-csc"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item className="!mt-4">
                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    size="large"
                    loading={loading}
                    disabled={canSubmit}
                    
                  >
                    Ödeme Yap
                  </Button>
                </Form.Item>
              </Form>
            </Col>

            <Col xs={24} md={10} className="flex justify-center">
              {/* Kendi görselini /public/images/card.png altına koyabilirsin */}
              <div className="w-[350px] h-[220px] relative -mt-10 ml-10">
                
                <Image
                  src="/card.png"
                  alt="Credit Card Illustration"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </Col>
          </Row>
        </div>
      </Card>
    </div>
  );
}
