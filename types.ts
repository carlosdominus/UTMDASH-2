
export interface DataRow {
  [key: string]: any;
}

export interface DashboardData {
  headers: string[];
  rows: DataRow[];
  types: Record<string, 'number' | 'string'>;
}

export interface FilterState {
  column: string;
  value: string | number;
}

export interface InsightResult {
  title: string;
  summary: string;
  recommendations: string[];
}
