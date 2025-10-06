// file: app/(auth)/login/page.tsx
'use client';

import React, { Suspense } from 'react';
import { Card, Skeleton } from 'antd';
import LoginForm from '@/components/auth/LoginForm';

function LoginFormSkeleton() {
  return (
    <div className="w-full max-w-[520px]">
      <Card className="shadow-sm" bodyStyle={{ padding: 16 }}>
        <Skeleton active avatar={false} title paragraph={{ rows: 6 }} />
      </Card>
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="flex items-center justify-center p-4">
      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
