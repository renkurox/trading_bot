# H4 Flow Scanner — Trading Logic

## Overview

A multi-timeframe momentum scanner for USDT perpetual futures. It identifies coins where trend, volume, open interest, and entry quality align — then ranks them by a composite score.

Scans every 4 hours. Alerts the top 5 setups via Telegram.

---

## Timeframes

- **H4** — Primary trend & entry signal (EMA20, EMA50)
- **Daily** — Higher timeframe confirmation (EMA20, EMA50)

## Indicators Used

### EMA Direction (20 & 50 period)

Compares current EMA value to previous with a 0.01% minimum threshold. This prevents false UP/DOWN signals in sideways markets.

- **UP** — EMA rising > 0.01%
- **DOWN** — EMA falling > 0.01%
- **FLAT** — change within noise range

### EMA Distance

Percentage distance from current price to EMA. Measures how "stretched" price is from its mean.

- **< 0.5%** — at EMA, ideal entry zone
- **0.5–1.5%** — acceptable
- **1.5–3%** — mildly extended
- **3–5%** — extended, higher risk
- **5–10%** — overextended, likely to revert
- **> 10%** — extreme, high reversal risk

### H4 Price Change

Average close of last 3 H4 candles vs prior 3. Smoothing over 3 candles filters out single-candle noise like dojis and wicks.

### Volume vs Average

Average volume of last 3 H4 candles compared to the average of the prior 20. Measures participation strength.

### Open Interest (OI)

Average of last 2 OI snapshots vs prior 2 (4h intervals). Combined with price direction to infer who is opening/closing positions:

| OI | Price | Interpretation |
|---|---|---|
| Rising | Up | New longs entering |
| Rising | Down | New shorts entering |
| Falling | Up | Shorts closing (weak rally) |
| Falling | Down | Longs closing (weak dump) |
| Flat (< 0.5%) | Any | No significant positioning |

### Funding Rate

Snapshot of current perpetual funding rate. Indicates crowd leverage:

- **< 0.03%** — Normal, no concern
- **0.03–0.05%** — Slightly elevated
- **0.05–0.1%** — Crowded, increased squeeze risk
- **> 0.1%** — Heavily crowded, high squeeze risk

---

## Trade Types

| Type | Meaning | When |
|---|---|---|
| **CONTINUATION** | Trend following entry | H4 EMAs aligned, price moving with trend |
| **PULLBACK** | Dip buy / bounce short | H4 EMAs aligned, price retraced to other side of EMA |
| **SQUEEZE** | Pre-breakout setup | H4 EMAs converging but not yet aligned |
| **REVERSAL_RISK** | Candle fighting trend | H4 EMAs aligned but current candle goes opposite |
| **UNCLEAR** | No setup | EMAs conflicting, no directional edge |

---

## Scoring System

Each coin gets a composite score from multiple components:

### Trend (max +6)
- H4 EMA20 + EMA50 both same direction: **+3**
- Only EMA20 trending: **+1**
- Daily EMA20 + EMA50 both confirm H4: **+3**
- Daily EMA20 only confirms: **+2**
- Daily opposes H4 (counter-trend): **-3**

### Entry Quality (max +3)
- Price pulled back through EMA (within 2%): **+2.5**
- Price within 0.3% of nearest EMA: **+3**
- Within 0.8%: **+2**
- Within 1.5%: **+1**
- Over 3% away: **-2**
- Over 5% away: **-3**
- Over 10% away: **-5**

### Volume (max +3)
- Continuous scale: volume above average % divided by 50
- Example: +150% volume = +3 points

### Open Interest (max +3)
- New positions matching trend direction: **+min(OI change %, 3)**
- Positions closing (weak move): **+0.5**
- New positions against trend: **-1**
- Counter-trend reduces OI credit by half

### H4 Momentum (max +3)
- Candle matches trend: **+min(H4 change %, 3)**
- Candle against trend (pullback): **+min(H4 change %, 1)**
- Flat trend: no credit

### Funding Rate Penalty
- ≥ 0.1%: **-3**
- ≥ 0.05%: **-1.5**
- ≥ 0.03%: **-0.5**

### Score Interpretation

| Score | Quality | Action |
|---|---|---|
| **12+** | Strong | High conviction, all signals aligned |
| **8–12** | Good | Tradeable, most signals confirm |
| **5–8** | Weak | Missing confirmations, risky |
| **< 5** | Noise | Skip |

---

## Alert Filters

A coin must pass ALL of these to be sent as an alert:

1. Score ≥ 8
2. Trade type is not REVERSAL_RISK or UNCLEAR
3. Not counter-trend (daily direction must match H4 or be flat)
4. EMA distance < 5% (not chasing)

Only the top 5 qualifying coins (by score) are sent.

---

## Coin Selection

Coins must meet minimum liquidity:

- **24h turnover**: $10M – $2B
- **Open interest**: ≥ $5M
- **Pair**: USDT perpetual only

Sorted by volume, top 15 analyzed per scan (API budget constraint).

---

## Schedule

Scans run every 4 hours at: **7:00, 11:00, 15:00, 19:00, 23:00, 3:00** (UTC+7)

---

## Ideal Setup Example

```
XAUUSDT | LONG | 14.9 | CONTINUATION
- H4 EMA20 UP, EMA50 UP               → +3
- Daily EMA20 UP, EMA50 UP             → +3
- Price 0.2% from EMA20 (at EMA)       → +3
- Volume +95% above average             → +1.9
- OI +15% with new longs entering       → +3
- H4 candle +1% confirming up           → +1
- Funding 0.00%                         → 0
```

## Red Flags (skip even if score looks OK)

- Trade type = REVERSAL_RISK — candle fighting the trend
- Reason mentions "counter-trend" or "overleveraged"
- EMA distance > 5% — chasing the move
- Volume below average — no participation
- Funding > 0.1% — squeeze risk
