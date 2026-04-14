"use client";

import { useEffect } from "react";
import Layout from "@/components/Layout";
import NetworkTable from "@/components/NetworkTable";
import ConfigPanel from "@/components/ConfigPanel";
import UrlBar from "@/components/UrlBar";
import { initWs } from "@/lib/ws";
import { useAppStore } from "@/lib/store";

export default function Home() {
  const addWsMessage = useAppStore((s) => s.addWsMessage);

  useEffect(() => {
    initWs((msg) => addWsMessage(msg));
  }, [addWsMessage]);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <header className="flex items-center gap-4 border-b border-gray-800 px-4 py-3">
        <span className="text-sm font-bold text-blue-400 whitespace-nowrap">
          🕷 Scraping Assistant
        </span>
        <UrlBar />
      </header>

      {/* Main 3-column layout */}
      <main className="flex-1 overflow-hidden">
        <Layout
          left={
            <div className="flex-1 rounded border border-gray-700 bg-gray-900 p-2">
              <h2 className="mb-2 text-sm font-semibold text-gray-300">
                Browser View
              </h2>
              <div className="flex h-64 items-center justify-center rounded bg-gray-800 text-xs text-gray-500">
                Browser preview will appear here
              </div>
            </div>
          }
          middle={<NetworkTable />}
          right={<ConfigPanel />}
        />
      </main>
    </div>
  );
}
