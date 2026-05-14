# Trading Scanner System V2

## Overview

This system is a multi-factor futures market scanner focused on:

- Trend continuation
- Early breakout detection
- Momentum expansion
- Positioning analysis
- Volatility regime detection
- Risk filtering

The goal is not only to detect assets already trending, but also identify:

- compressed energy
- volatility expansion potential
- pre-breakout positioning
- exhaustion conditions

---

# Core Philosophy

The system evaluates market structure through:

1. Trend
2. Momentum
3. Volatility
4. Open Interest
5. Volume
6. Funding
7. Market Phase

The scanner prioritizes probability-based ranking instead of binary signals.

---

# Multi-Timeframe Trend Engine

## Daily Timeframe

Purpose:
- Detect macro market bias
- Define primary direction

Metrics:
- EMA20 slope
- EMA50 slope
- EMA alignment

Rules:

### Bullish Daily

- EMA20 slope > 0
- EMA50 slope > 0
- EMA20 above EMA50

### Bearish Daily

- EMA20 slope < 0
- EMA50 slope < 0
- EMA20 below EMA50

### Neutral Daily

- EMA convergence
- Mixed slopes

---

## H4 Timeframe

Purpose:
- Momentum timing
- Expansion confirmation
- Pullback evaluation

Metrics:
- H4 price change
- EMA momentum
- Momentum acceleration

Momentum Classification:

| H4 Move | Classification |
|---|---|
| < 0.3% | Weak |
| 0.3% - 0.8% | Moderate |
| 0.8% - 1.5% | Strong |
| > 1.5% | Expansion |

---

# Volatility Compression Engine

Purpose:
- Detect potential breakout setups before expansion

This replaces the old simplistic:

"EMA converging = weak"

logic.

---

## ATR Compression

Formula:

ATR(14) compared against ATR moving average.

Rules:

- ATR14 < ATR50 * 0.7
→ volatility compressed

---

## Bollinger Band Width Compression

Formula:

BBW = (Upper Band - Lower Band) / Middle Band

Rules:

- Low BBW percentile
→ strong compression

---

## Candle Range Compression

Rules:

Average range of last 5 candles
<
Average range of last 20 candles

→ reduced volatility

---

## Compression Score

Compression Score =

- ATR Compression × 40%
- BB Width Compression × 40%
- Candle Range Compression × 20%

---

# Open Interest Engine

Purpose:
- Detect new positioning entering market
- Differentiate continuation vs squeeze vs liquidation

---

## OI Interpretation Matrix

| Price | OI | Meaning |
|---|---|---|
| Up | Up | Long buildup |
| Up | Down | Short covering |
| Down | Up | Short buildup |
| Down | Down | Long liquidation |

---

## Early Breakout OI Logic

High-quality breakout conditions:

- OI rising gradually
- Price compressed
- Volume slowly increasing
- Funding neutral

This indicates:

"position accumulation before expansion"

---

## Bad Breakout Conditions

- Vertical price movement
- OI spike too quickly
- Extreme funding
- Price too extended from EMA

This indicates:

- crowded positioning
- possible exhaustion
- squeeze risk

---

## OI Momentum Score

Instead of using only 1-candle OI change:

Use rolling weighted OI momentum.

Example:

Weighted OI Momentum =

- recent OI changes weighted over last 6 periods

This reduces noise and fake spikes.

---

# Volume Engine

Purpose:
- Detect participation quality
- Confirm expansion
- Detect dry-up before breakout

---

## Relative Volume

Formula:

Current Volume / Average Volume(20)

---

## Dollar Volume

Formula:

Volume × Price

This prevents low-price assets from appearing stronger than they really are.

---

## Volume Phases

### Dry-Up Phase

- Volume below average
- Compression active

This can indicate:

"energy buildup"

NOT automatically weakness.

---

### Expansion Phase

- Volume rising above average
- Breakout confirmation

This confirms participation.

---

# Funding Rate Engine

Purpose:
- Detect crowding risk
- Detect healthy leverage conditions

---

## Funding Interpretation

| Funding | Meaning |
|---|---|
| Neutral | Healthy market |
| Slightly Positive | Bullish but healthy |
| Very Positive | Crowded longs |
| Very Negative | Crowded shorts |

---

## Funding Logic

High funding should NOT automatically invalidate trend.

Instead:

- apply dynamic penalty
- adjust by market regime

Bull markets can sustain elevated funding for long periods.

---

# Market Phase Classification

This becomes the core of the system.

---

## CONTINUATION

Conditions:

- EMA aligned
- Daily aligned
- Strong H4 momentum
- OI confirms trend
- Price already expanding

Meaning:

- confirmed trend continuation

---

## EARLY_BREAKOUT

Conditions:

- Compression active
- OI rising
- Volume slowly increasing
- Funding healthy
- Daily aligned

Meaning:

- volatility expansion likely approaching

---

## VOLATILITY_EXPANSION

Conditions:

- Compression recently released
- Volume surge
- Momentum acceleration
- OI acceleration

Meaning:

- breakout confirmed

---

## EXHAUSTION

Conditions:

- Price too extended from EMA
- Funding extreme
- Volume climax
- Momentum slowing
- OI crowded

Meaning:

- increased reversal risk

---

## REVERSAL_RISK

Conditions:

- Counter-trend OI
- Weak volume confirmation
- Divergence conditions

Meaning:

- trend instability

---

# Distance From EMA Engine

Purpose:
- Avoid chasing extended moves
- Improve risk/reward quality

---

## Rules

### Near EMA

- Healthy continuation zone
- Better RR

### Too Far From EMA

- Mean reversion risk increases
- Apply exhaustion penalty

---

# Dual Scoring Architecture

The system now uses TWO independent scores.

---

# 1. Confirmation Score

Purpose:
- Rank confirmed trends

Weights:

| Factor | Weight |
|---|---|
| Trend Alignment | 35% |
| Momentum | 25% |
| OI Confirmation | 20% |
| Volume | 10% |
| Funding | 10% |

---

# 2. Potential Score

Purpose:
- Rank setups likely to expand soon

Weights:

| Factor | Weight |
|---|---|
| Compression | 30% |
| OI Buildup | 30% |
| Volume Expansion | 20% |
| Funding Health | 10% |
| Daily Bias | 10% |

---

# Example Interpretation

## Confirmed Continuation

| Asset | Confirmation | Potential |
|---|---|---|
| CL | High | Low |

Interpretation:

- trend already active
- continuation setup

---

## Early Breakout

| Asset | Confirmation | Potential |
|---|---|---|
| MNT | Medium | High |

Interpretation:

- energy buildup
- breakout watchlist

---

# Breakout Trigger Engine

The system should NOT alert only because:

- OI rising
- compression active

A breakout trigger is required.

---

## Long Trigger

Conditions:

- Close above local range
- Volume expansion
- OI still rising
- Momentum acceleration

---

## Short Trigger

Conditions:

- Close below support
- OI expansion
- Negative momentum acceleration

---

# Exhaustion Detection Engine

Purpose:
- Prevent chasing late-stage trends

---

## Exhaustion Signals

- Momentum extremely extended
- Volume declining during large move
- Extreme funding
- Distance from EMA too large
- OI overcrowding

Apply:

- exhaustion penalty
- reduce continuation confidence

---

# Ranking System

The scanner output should be separated into categories.

---

# Category A — Confirmed Trends

Examples:

- BTC
- ETH
- strong continuation setups

---

# Category B — Breakout Watchlist

Examples:

- compressed volatility
- OI buildup
- potential expansion

---

# Category C — Exhaustion Risk

Examples:

- overextended moves
- crowded positioning
- possible squeeze risk

---

# Scanner Philosophy

The system aims to detect:

1. Confirmed trend continuation
2. Early volatility expansion
3. Positioning buildup
4. Market crowding risk
5. Exhaustion conditions

The scanner should avoid:

- blind EMA crossover trading
- pure momentum chasing
- late-stage crowded entries
- fake breakout conditions

---

# Final Objective

The goal is to create a:

- professional-grade futures scanner
- probabilistic ranking engine
- volatility expansion detector
- positioning-aware market analysis system

capable of identifying both:

- active trends
- hidden pre-breakout opportunities

before major expansion occurs.
