import axios from "axios";

const BASE_URL = "https://api.bybit.com";

export async function fetchTickers() {
  const response =
    await axios.get(
      `${BASE_URL}/v5/market/tickers`,
      {
        params: {
          category: "linear"
        }
      }
    );

  return response.data.result.list;
}

export async function fetchOIHistory(symbol: string) {
  const response = await axios.get(
    `${BASE_URL}/v5/market/open-interest`,
    {
      params: {
        category: "linear",
        symbol,
        intervalTime: "4h",
        limit: 4,
      },
    }
  );

  return response.data.result.list;
}

export async function fetchDailyKline(symbol: string) {
  const response = await axios.get(
    `${BASE_URL}/v5/market/kline`,
    {
      params: {
        category: "linear",
        symbol,
        interval: "D",
        limit: 60,
      },
    }
  );
  return response.data.result.list;
}

export async function fetchH4Kline(
  symbol: string
) {
  const response =
    await axios.get(
      `${BASE_URL}/v5/market/kline`,
      {
        params: {
          category: "linear",
          symbol,
          interval: "240",
          limit: 60,
        }
      }
    );

  return response.data.result.list;
}
