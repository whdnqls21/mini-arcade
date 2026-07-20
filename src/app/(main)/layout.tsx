"use client";

import type { ReactNode } from "react";

import { Card } from "@/components/Card";
import LoginScreen from "@/components/LoginScreen";
import { StateProvider, useAppState } from "@/components/StateProvider";

function Gate({ children }: { children: ReactNode }) {
  const { state, loading, error } = useAppState();

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 pt-20 text-ink-dim">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-pitch-line border-t-grass" />
        <p className="text-sm">불러오는 중…</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mt-8 flex flex-col items-center gap-2 py-10 text-center">
        <p className="font-display text-lg text-danger">문제가 생겼어요</p>
        <p className="text-sm text-ink-dim">{error}</p>
        <p className="text-xs text-ink-faint">환경변수(.env)와 Supabase 설정을 확인하세요.</p>
      </Card>
    );
  }

  if (!state?.session) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <StateProvider>
      <Gate>{children}</Gate>
    </StateProvider>
  );
}
