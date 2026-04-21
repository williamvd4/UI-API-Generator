import { create } from "zustand";
import { GeneratedConfig, NetworkRequest, RequestDetail } from "@/types/network";

type AppState = {
  url: string;
  sessionId: string;
  networkLog: NetworkRequest[];
  selectedRequestId: string | null;
  selectedRequest: RequestDetail | null;
  config: GeneratedConfig | null;
  configText: string;
  wsMessages: unknown[];
  setUrl: (url: string) => void;
  setSessionId: (id: string) => void;
  setRequests: (requests: NetworkRequest[]) => void;
  upsertRequest: (request: NetworkRequest) => void;
  selectRequest: (request: RequestDetail | null) => void;
  setConfig: (config: GeneratedConfig | null) => void;
  setConfigText: (text: string) => void;
  addWsMessage: (msg: unknown) => void;
  resetApp: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  url: "",
  sessionId: "default",
  networkLog: [],
  selectedRequestId: null,
  selectedRequest: null,
  config: null,
  configText: "",
  wsMessages: [],
  setUrl: (url) => set({ url }),
  setSessionId: (id) => set({ sessionId: id }),
  setRequests: (requests) => set({ networkLog: requests }),
  upsertRequest: (request) =>
    set((state) => ({
      networkLog: [request, ...state.networkLog.filter((item) => item.id !== request.id)],
    })),
  selectRequest: (request) => set({ selectedRequest: request, selectedRequestId: request?.id ?? null }),
  setConfig: (config) =>
    set({
      config,
      configText: config ? JSON.stringify(config, null, 2) : "",
    }),
  setConfigText: (text) => set({ configText: text }),
  addWsMessage: (msg) => set((state) => ({ wsMessages: [...state.wsMessages.slice(-199), msg] })),
  resetApp: () =>
    set({
      url: "",
      // generate a fresh session id so we don't re-use previous in-memory state
      sessionId: `default-${Date.now()}`,
      networkLog: [],
      selectedRequestId: null,
      selectedRequest: null,
      config: null,
      configText: "",
      wsMessages: [],
    }),
}));
