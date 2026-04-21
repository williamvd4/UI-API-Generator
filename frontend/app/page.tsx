"use client";

import { useEffect } from "react";
import Layout from "@/components/Layout";
import NetworkTable from "@/components/NetworkTable";
import ConfigPanel from "@/components/ConfigPanel";
import UrlBar from "@/components/UrlBar";
import RequestDetails from "@/components/RequestDetails";
import { initWs } from "@/lib/ws";
import { useAppStore } from "@/lib/store";
import { NetworkRequest } from "@/types/network";

export default function Home() {
  const addWsMessage = useAppStore((s) => s.addWsMessage);
  const upsertRequest = useAppStore((s) => s.upsertRequest);
  const resetApp = useAppStore((s) => s.resetApp);

  useEffect(() => {
    return initWs((msg) => {
      addWsMessage(msg);
      if (
        msg &&
        typeof msg === "object" &&
        "type" in msg &&
        msg.type === "request_captured" &&
        "request" in msg
      ) {
        // Only upsert requests for the active session id to avoid showing
        // previously-captured requests from other sessions/processes.
        const currentSession = useAppStore.getState().sessionId;
        try {
          const r = msg.request as NetworkRequest & { session_id?: string };
          if (r.session_id === currentSession) upsertRequest(r as NetworkRequest);
        } catch {
          /* ignore malformed messages */
        }
      }
    });
  }, [addWsMessage, upsertRequest]);

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-white">
      <header className="flex items-center gap-4 border-b border-gray-800 px-4 py-3">
        <span className="whitespace-nowrap text-sm font-bold text-blue-400">🕷 Scraping Assistant</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={resetApp}
            className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500"
          >
            Reset
          </button>
          <UrlBar />
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <Layout
          left={null}
          middle={
            <div className="flex h-full flex-col gap-3">
              <NetworkTable />
              <RequestDetails />
            </div>
          }
          right={<ConfigPanel />}
        />
      </main>
    </div>
  );
}
