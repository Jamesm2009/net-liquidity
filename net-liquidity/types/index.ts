export interface DataPoint {
  date: string;        // YYYY-MM-DD (Wednesday, aligns with FRED weekly series)
  fedAssets: number;   // WALCL — Fed total assets, billions
  tga: number;         // WTREGEN — Treasury General Account, billions
  rrp: number;         // RRPONTSYD — Overnight reverse repos, billions
  netLiquidity: number; // fedAssets - tga - rrp
  sp500: number;       // S&P 500 closing price
}

export interface ApiResponse {
  data: DataPoint[];
  lastUpdated: string;
  count: number;
}
