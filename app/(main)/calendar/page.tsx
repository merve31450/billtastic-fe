'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import { EventInput, EventClickArg } from '@fullcalendar/core';
import { EventReceiveArg } from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import trLocale from '@fullcalendar/core/locales/tr';
import {
  App,
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Space,
  TimePicker,
  Typography,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text } = Typography;

// ====== API Types ======
type ApiEvt = {
  id: number;
  title: string;
  notes: string;
  eventDate: string; // ISO
};

const API = 'http://localhost:8080/api/calendars';

// ====== Helpers ======
type HttpError = Error & { status?: number; bodyText?: string };

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('jwtToken') || localStorage.getItem('token');
}

async function apiFetch(url: string, init: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const err: HttpError = new Error(`HTTP ${res.status} ${res.statusText}`);
    err.status = res.status;
    try {
      err.bodyText = await res.text();
    } catch {
      /* ignore */
    }
    throw err;
  }
  return res;
}

// TZ fix: send local date/time as exact wall-clock time
function toLocalIso(date: Date) {
  const d = new Date(date);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString();
}

function apiToEvent(a: ApiEvt): EventInput {
  return {
    id: String(a.id),
    title: a.title,
    start: a.eventDate,
    extendedProps: { notes: a.notes ?? '' },
  };
}

// ====== Component ======
export default function CalendarPage() {
  const { message, notification, modal } = App.useApp();

  const [events, setEvents] = useState<EventInput[]>([]);
  const [loading, setLoading] = useState(false);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTime, setEditTime] = useState<Dayjs | null>(null);
  const currentEventRef = useRef<{ id: string; start: Date } | null>(null);

  // Draggable external items init
  useEffect(() => {
    const el = document.getElementById('external-events');
    if (el) {
      new Draggable(el, {
        itemSelector: '.fc-external',
        eventData: (ev) => ({
          title: ev.getAttribute('data-title') ?? ev.textContent ?? '',
        }),
      });
    }
  }, []);

  const isAuthenticated = useCallback(() => {
    const t = getToken();
    if (!t) {
      modal.warning({
        title: 'Oturum gerekli',
        content: 'Bu işlem için giriş yapmalısınız.',
        okText: 'Giriş Yap',
        onOk: () => (window.location.href = '/login'),
      });
      return false;
    }
    return true;
  }, [modal]);

  // Load events
  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    try {
      const res = await apiFetch(API);
      const list: ApiEvt[] = await res.json();
      setEvents(list.map(apiToEvent));
      message.success(`Takvim yüklendi (${list.length} etkinlik)`);
    } catch (e: unknown) {
      const err = e as { status?: number; bodyText?: string; message?: string };
      const status: number | undefined = err?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('token');
        notification.error({
          message: status === 401 ? 'Yetkisiz' : 'Yasak',
          description: 'Oturumunuz geçersiz. Lütfen tekrar giriş yapın.',
        });
        setTimeout(() => (window.location.href = '/login'), 800);
      } else {
        notification.error({
          message: 'Takvim verisi alınamadı',
          description: err?.bodyText || err?.message || 'Bilinmeyen hata',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, message, notification]);

  useEffect(() => {
    load();
  }, [load]);

  // Receive (drop new)
  const onReceive = async ({ event }: EventReceiveArg) => {
    if (!isAuthenticated()) {
      event.remove();
      return;
    }
    try {
      const start = event.start!;
      const payload = {
        title: event.title,
        eventDate: toLocalIso(start),
        notes: '',
      };
      const res = await apiFetch(API, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const saved: ApiEvt = await res.json();
      if (!saved?.id) throw new Error('Geçersiz yanıt: ID yok');

      event.setProp('id', String(saved.id));
      message.success('Etkinlik eklendi');
      // isteğe bağlı: yeniden yükle
      load();
    } catch (e: unknown) {
      event.remove();
      const err = e as { status?: number; bodyText?: string; message?: string };
      const status: number | undefined = err?.status;
      if (status === 401) notification.error({ message: '401 Unauthorized', description: 'Giriş yapın.' });
      else if (status === 403) notification.error({ message: '403 Forbidden', description: 'Yetkiniz yok.' });
      else notification.error({ message: 'Etkinlik eklenemedi', description: err?.bodyText || err?.message });
    }
  };

  // Click (open edit modal)
  const onClick = ({ event }: EventClickArg) => {
    currentEventRef.current = { id: String(event.id), start: event.start! };
    setEditTitle(event.title);
    type ExtendedProps = { notes?: string };
    const extendedProps = event.extendedProps as ExtendedProps;
    setEditNotes(extendedProps?.notes || '');
    // time field (optional)
    const d = dayjs(event.start!);
    setEditTime(d);
    setEditOpen(true);
  };

  // Save edit
  const handleSave = async () => {
    const cur = currentEventRef.current;
    if (!cur) return;
    if (!editTitle.trim()) {
      message.error('Başlık boş olamaz');
      return;
    }
    try {
      // combine date + selected time
      const base = dayjs(cur.start);
      const when = editTime ? base.hour(editTime.hour()).minute(editTime.minute()) : base;
      const payload = {
        title: editTitle.trim(),
        eventDate: toLocalIso(when.toDate()),
        notes: editNotes.trim(),
      };
      await apiFetch(`${API}/${cur.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      message.success('Etkinlik güncellendi');
      setEditOpen(false);
      load();
    } catch (e: unknown) {
      const err = e as { status?: number; bodyText?: string; message?: string };
      const status: number | undefined = err?.status;
      if (status === 400) notification.error({ message: '400 Bad Request', description: err?.bodyText || 'Veri hatalı' });
      else if (status === 404) notification.error({ message: '404 Not Found', description: 'Etkinlik bulunamadı' });
      else if (status === 409) notification.error({ message: '409 Conflict', description: 'Çakışma oluştu' });
      else notification.error({ message: 'Güncelleme başarısız', description: err?.bodyText || err?.message });
    }
  };

  // Delete
  const handleDelete = () => {
    const cur = currentEventRef.current;
    if (!cur) return;
    Modal.confirm({
      title: 'Etkinliği sil',
      content: 'Bu etkinlik kalıcı olarak silinecek. Emin misiniz?',
      okType: 'danger',
      okText: 'Sil',
      cancelText: 'İptal',
      onOk: async () => {
        try {
          await apiFetch(`${API}/${cur.id}`, { method: 'DELETE' });
          message.success('Etkinlik silindi');
          setEditOpen(false);
          setEvents((prev) => prev.filter((e) => e.id !== cur.id));
        } catch (e: unknown) {
          const err = e as { status?: number; bodyText?: string; message?: string };
          const status: number | undefined = err?.status;
          if (status === 404) notification.warning({ message: 'Zaten silinmiş olabilir (404)' });
          else notification.error({ message: 'Silme başarısız', description: err?.bodyText || err?.message });
        }
      },
    });
  };

  const headerToolbar = useMemo(
    () => ({
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay',
    }),
    []
  );

  return (
    <div className="min-h-[80vh] p-4">
      <Row gutter={[16, 16]}>
        {/* External draggable palette (optional) */}
        <Col xs={24} md={6}>
          <Card className="rounded-2xl">
            <Title level={5} className="!mb-2">Sürükle & Bırak Etkinlikleri</Title>
            <Text type="secondary">Kutudaki öğeleri takvime bırakın.</Text>
            <div id="external-events" className="mt-4 space-y-2">
              <div className="fc-external px-3 py-2 rounded bg-neutral-100 border" data-title="Toplantı">
                Toplantı
              </div>
              <div className="fc-external px-3 py-2 rounded bg-neutral-100 border" data-title="Arama">
                Arama
              </div>
              <div className="fc-external px-3 py-2 rounded bg-neutral-100 border" data-title="Odak Çalışması">
                Odak Çalışması
              </div>
            </div>

            {loading && (
              <Alert
                className="mt-4"
                message="Takvim verileri yükleniyor…"
                type="info"
                showIcon
              />
            )}
          </Card>
        </Col>

        {/* Calendar */}
        <Col xs={24} md={18}>
          <Card className="rounded-2xl">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locales={[trLocale]}
              locale="tr"
              editable
              droppable
              events={events}
              eventReceive={onReceive}
              eventClick={onClick}
              headerToolbar={headerToolbar}
              firstDay={1}
              height="auto"
              timeZone="Europe/Istanbul"
              buttonText={{ today: 'Bugün', month: 'Ay', week: 'Hafta', day: 'Gün' }}
              eventDidMount={({ event, el }) => {
                type ExtendedProps = { notes?: string };
                const extendedProps = event.extendedProps as ExtendedProps;
                el.setAttribute('title', `${event.title}\n${extendedProps?.notes || ''}`);
              }}
              loading={(isLoading) => setLoading(isLoading)}
            />
          </Card>
        </Col>
      </Row>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleSave}
        title="Etkinlik Detayları"
        okText="Kaydet"
        cancelText="Kapat"
        destroyOnClose
        footer={(_, { OkBtn, CancelBtn }) => (
          <Space className="w-full justify-between">
            <Button danger onClick={handleDelete}>Sil</Button>
            <Space>
              <CancelBtn />
              <OkBtn />
            </Space>
          </Space>
        )}
      >
        <Form layout="vertical">
          <Form.Item label="Başlık" required>
            <Input
              placeholder="Etkinlik başlığı"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          </Form.Item>
          <Form.Item label="Saat (opsiyonel)">
            <TimePicker
              className="w-full"
              value={editTime}
              onChange={(t) => setEditTime(t)}
              format="HH:mm"
            />
          </Form.Item>
          <Form.Item label="Notlar">
            <Input.TextArea
              rows={4}
              placeholder="Ek notlar…"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
