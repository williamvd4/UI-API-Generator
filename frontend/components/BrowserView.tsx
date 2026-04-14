"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { screenshotUrl } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export default function BrowserView() {
  const sessionId = useAppStore((s) => s.sessionId);
  const [src, setSrc] = useState<string>(screenshotUrl(sessionId));

  useEffect(() => {
    const refresh = () => setSrc(screenshotUrl(sessionId));
    refresh();
    const timer = setInterval(refresh, 2500);
    return () => clearInterval(timer);
  }, [sessionId]);

  return (
    <div className="flex-1 rounded border border-gray-700 bg-gray-900 p-2">
      <h2 className="mb-2 text-sm font-semibold text-gray-300">Browser View</h2>
      <div className="relative h-[28rem] w-full overflow-hidden rounded bg-gray-800">
        <Image src={src} alt="Playwright session screenshot" fill unoptimized className="object-contain" />
      </div>
    </div>
  );
}
