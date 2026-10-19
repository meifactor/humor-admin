import type { ReactNode } from "react";
import { LineBullet } from "@/components/line-bullet";

// Centered station-sign card used by the sign-in and not-authorized pages.
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-md bg-black px-6 pt-3 pb-6 ring-1 ring-edge">
        <div className="mb-5 h-[3px] bg-white" aria-hidden />
        <div className="flex items-center gap-1.5">
          <LineBullet color="#EE352E">H</LineBullet>
          <LineBullet color="#FCCC0A" textColor="#000000">
            P
          </LineBullet>
          <span className="ml-1 text-sm font-bold tracking-wide text-ink-2 uppercase">Control Center</span>
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">{title}</h1>
        {children}
      </div>
    </main>
  );
}
