export type NetworkRequest = {
  id: string;
  session_id: string;
  url: string;
  path: string;
  method: string;
  status: number;
  headers: Record<string, string>;
  content_type: string;
  size: number;
  score: number;
  signals: string[];
  data_path: string;
};

export type RequestDetail = NetworkRequest & {
  json: unknown;
};

export type GeneratedConfig = {
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  params: Record<string, string>;
  pagination: { type: string; param: string } | null;
  data_path: string;
  fields: Record<string, string | null>;
  score: {
    score: number;
    signals: string[];
    data_path: string;
  };
};
