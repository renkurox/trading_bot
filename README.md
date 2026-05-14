# Trading Scanner System V2

Multi-factor futures scanner. Detects confirmed trends and pre-breakout setups.


## Engines

### Trend (Daily + H4)

- Daily EMA20/EMA50 → macro bias
- H4 EMA20/EMA50 → momentum timing
- Smoothed H4 change (3-candle avg vs prior 3)
- Momentum classification: WEAK / MODERATE / STRONG / EXPANSION
- Momentum acceleration: recent move vs prior move (detects expanding/decaying momentum)

### Volatility Compression

Three-factor compression score (0-100):

| Factor | Weight | Logic |
|---|---|---|
| ATR Compression | 40% | ATR14 < ATR50 × 0.7 |
| Bollinger Band Width | 40% | BBW percentile (lower = more compressed) |
| Candle Range | 20% | Avg range last 5 < avg range last 20 |

Compressed = score > 60

**False positive filter**: compression only valid when volume not in deep dry-up (> -50%) OR daily trend exists.

### Open Interest

- OI interpretation matrix (price × OI direction → signal)
- Weighted 8-period momentum (recent changes weighted 4.5×, oldest 1×)
- Signals: LONGS_OPEN, SHORTS_OPEN, SHORTS_CLOSE, LONGS_CLOSE, NEUTRAL

### Volume

- Relative volume: last 3 candles vs average of prior 20
- Dollar volume filter: 10M–2B USD turnover
- Dry-up during compression = energy buildup (not weakness)

### Funding Rate

| Level | Penalty |
|---|---|
| < 0.03% | None (healthy) |
| 0.03–0.05% | Light |
| 0.05–0.1% | Moderate |
| > 0.1% | Heavy (squeeze risk) |

### EMA Distance

Continuous scoring — no dead zones:

| Distance | Effect on Score |
|---|---|
| Pullback (crossed EMA, < 2%) | +20 |
| < 0.5% | +20 (sweet spot) |
| 0.5–1.5% | +10 |
| 1.5–3% | +5 |
| 3–5% | -10 |
| 5–8% | -20 |
| 8–10% | -30 |
| > 10% | -40 |

---

## Dual Scoring

### Confirmation Score (0-100)

Ranks confirmed trends.

| Factor | Weight |
|---|---|
| Trend Alignment + EMA Distance | 35% |
| Momentum (direction match) | 25% |
| OI Confirmation | 20% |
| Volume | 10% |
| Funding Health | 10% |

### Potential Score (0-100)

Ranks pre-breakout setups.

| Factor | Weight |
|---|---|
| Compression | 25% |
| OI Buildup | 25% |
| Volume Phase | 15% |
| EMA Proximity | 15% |
| Funding Health | 10% |
| Daily Bias | 10% |

### Score Assignment by Category

- Category A → uses Confirmation Score
- Category B → uses Potential Score
- Category C → uses max(Confirmation, Potential)

---

## Market Phases

| Phase | Trigger |
|---|---|
| CONTINUATION | EMA aligned + H4 matches + confirmation > 50 |
| EARLY_BREAKOUT | Compressed + OI building + funding healthy |
| VOLATILITY_EXPANSION | Breakout triggered + volume surge + momentum |
| EXHAUSTION | Extended > 5% + elevated funding + momentum slowing |
| REVERSAL_RISK | EMA aligned but H4 against trend |
| UNCLEAR | No alignment |

### Breakout Trigger

- Long: close > highest close of last 10 candles
- Short: close < lowest close of last 10 candles
- Required for VOLATILITY_EXPANSION classification

---

## Categories

| Category | Criteria | Action |
|---|---|---|
| A | CONTINUATION + confirmation ≥ 60, or VOLATILITY_EXPANSION + confirmation ≥ 50 | Trade |
| B | EARLY_BREAKOUT or VOLATILITY_EXPANSION (lower conf) | Watchlist |
| C | Everything else | Skip |

---

## Worker (Telegram Alerts)

- Runs every 1 hour
- Scans top 15 coins by volume
- Sends only the single best setup
- Filter: Category A (conf ≥ 60) or B (pot ≥ 55), not exhausted, distEma50 < 5%

### Message Format

```
NEARUSDT  LONG  CONTINUATION
Confirm: 78.5  Potential: 32.0
Daily+H4 UP, longs opening, vol above avg, at EMA
EMA20 +0.18%  EMA50 +3.42%  H4 +1.85% STRONG
Daily UP  OI +2.30% Longs opening  Vol +95%  FR 0.0050%
```

---

## Filters

- Volume: 10M–2B USD
- Open Interest: minimum 5M
- Symbols: USDT perpetuals only
- Minimum 51 H4 candles required

---

## Philosophy

The scanner avoids:

- Blind EMA crossover trading
- Pure momentum chasing
- Late-stage crowded entries
- Fake breakout conditions (no price trigger)

The scanner detects:

- Confirmed trend continuation with good entry
- Hidden pre-breakout energy (compression + OI + volume)
- Exhaustion before reversal
- Positioning buildup before expansion
