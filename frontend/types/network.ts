export type NetworkRequest = {
  id: string;
  session_id: string;
  url: string;
  path: string;
  method: string;
  status: number;
  headers: Record<string, string>;
  content_type: string;
  resource_type: string;
  size: number;
  score: number;
  signals: string[];
  data_path: string;
  // Optional fields added by backend for richer UI
  request_post_data?: string;
  graphql_operation?: string;
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
  data_path: string | null;
  fields: Record<string, string | null>;
  score: {
    score: number;
    signals: string[];
    data_path: string | null;
  };
  selected_fields?: string[];
};
