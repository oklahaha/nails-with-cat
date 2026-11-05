"""MBG/CNBD-k: the MBG/NBD customer model with regular (Erlang-k) gaps between visits.

BG/NBD and MBG/NBD assume that, while a customer is still active, visits come
as a Poisson process: gaps are exponential, with a coefficient of variation
(CV) of 1. Nail and lash customers come on a rhythm (infills, refills): the
median customer with 5+ visits has a gap CV of about 0.66. Under the Poisson
assumption a long silence says little, so an overdue regular stays "alive"
for too long.

MBG/CNBD-k (Reutterer, Platzer & Schröder 2021, IJRM 38(1); Platzer &
Reutterer 2016, Marketing Science 35(5)) keeps everything else and makes
the gaps Erlang-k, i.e. Gamma(k, λ) with CV = 1/√k:

* while active, gaps ~ Erlang-k with rate λ; λ ~ Gamma(r, α) across customers
* at time 0 and after every repeat visit, the customer drops out for good
  with probability p; p ~ Beta(a, b) across customers (the "M" in MBG:
  dropping out right after the first visit is allowed)

k = 1 is exactly MBG/NBD, which the tests check against lifetimes. k is
chosen by maximum likelihood over 1..K, as in the R package BTYDplus, which
has the reference implementation (Python has none).

Data per customer, in weeks from the first visit week (as clv.rfm_summary):
x (repeat visit weeks), t_x (recency), T (age), and litt, the sum of the
logs of the gaps between visit weeks, which the Erlang density needs.

Likelihood (λ and p integrated out, closed form):

    L = exp(C) · [ E[(1-p)^(x+1)] · Σ_{i<k} Γ(r+kx+i) / (α+T)^(r+kx+i) · u^i / i!
                 + E[(1-p)^x p]   · Γ(r+kx) / (α+t_x)^(r+kx) ]

with u = T − t_x and C = (k−1)·litt − x·log((k−1)!) + r·log α − log Γ(r).
The first term is "still active" (no visit in the last u weeks: fewer than
k Poisson phases), the second "dropped out right after the last visit".

Forecasts aren't closed-form for k > 1 (the gap process isn't memoryless),
so expected visits are simulated from each customer's posterior, which is
exact in distribution: λ and the phases already done since the last visit
are drawn jointly (a mixture of Gammas over i), the remaining part of the
current gap is Gamma(k − i, λ), later gaps Gamma(k, λ), each visit followed
by a dropout draw with p from its posterior Beta.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.special import betaln, gammaln, logsumexp

from analysis.clv import weekly_transactions


def cnbd_summary(days: pd.DataFrame, cutoff: pd.Timestamp) -> pd.DataFrame:
    """frequency / recency / T in weeks (as clv.rfm_summary), plus litt.

    litt = Σ log(gap in weeks) over the gaps between consecutive visit weeks;
    0 for customers with no repeat visit.
    """
    from analysis.clv import rfm_summary

    summary = rfm_summary(days, cutoff)
    tx = weekly_transactions(days[days["date"] <= pd.Timestamp(cutoff)]).sort_values(["customer_id", "week"])
    gaps = tx.groupby("customer_id")["week"].diff().dropna().map(lambda offset: offset.n)
    litt = np.log(gaps.astype(float)).groupby(tx.loc[gaps.index, "customer_id"]).sum()
    summary["litt"] = litt.reindex(summary.index).fillna(0.0)
    return summary


def _log_terms(params: np.ndarray, k: int, x, t_x, T, litt) -> tuple[np.ndarray, np.ndarray]:
    """log of the "active" and "dropped" parts of each customer's likelihood."""
    r, alpha, a, b = params
    u = T - t_x
    const = (k - 1) * litt - x * gammaln(k) + r * np.log(alpha) - gammaln(r)
    i = np.arange(k)[:, None]
    shape = r + k * x + i
    with np.errstate(divide="ignore"):
        log_u = np.where(u > 0, np.log(np.where(u > 0, u, 1.0)), -np.inf)
    # u = 0: only i = 0 survives (0^0 = 1)
    phase = np.where(i == 0, 0.0, i * log_u)
    active_lam = logsumexp(gammaln(shape) - shape * np.log(alpha + T) + phase - gammaln(i + 1), axis=0)
    drop_lam = gammaln(r + k * x) - (r + k * x) * np.log(alpha + t_x)
    log_beta = betaln(a, b)
    active = const + betaln(a, b + x + 1) - log_beta + active_lam
    dropped = const + betaln(a + 1, b + x) - log_beta + drop_lam
    return active, dropped


def log_likelihood(params: np.ndarray, k: int, x, t_x, T, litt) -> np.ndarray:
    """Per-customer log-likelihood under MBG/CNBD-k."""
    active, dropped = _log_terms(params, k, x, t_x, T, litt)
    return np.logaddexp(active, dropped)


@dataclass
class CNBDFit:
    k: int
    r: float
    alpha: float
    a: float
    b: float
    log_likelihood: float

    @property
    def params(self) -> np.ndarray:
        return np.array([self.r, self.alpha, self.a, self.b])


def _arrays(summary: pd.DataFrame):
    return tuple(summary[c].to_numpy(dtype=float) for c in ("frequency", "recency", "T", "litt"))


def fit_k(summary: pd.DataFrame, k: int, penalizer: float = 0.001) -> CNBDFit:
    """Maximum likelihood for one k.

    Optimised over log-parameters with a small L2 penalty on them, which only
    keeps a parameter from running off when the data can't pin it down. (A
    penalty on the raw parameters, as lifetimes uses, would pull α toward 0
    here: α ≈ 18 weeks costs more than its likelihood gain.)
    """
    data = _arrays(summary)

    def nll(log_params: np.ndarray) -> float:
        params = np.exp(log_params)
        ll = log_likelihood(params, k, *data).sum()
        return -ll / len(data[0]) + penalizer * float(np.sum(log_params ** 2))

    best = None
    for start in ([0.0, 0.0, 0.0, 0.0], [np.log(0.5), np.log(5.0), np.log(0.5), np.log(2.0)]):
        res = minimize(nll, np.array(start), method="Nelder-Mead",
                       options={"maxiter": 8000, "xatol": 1e-7, "fatol": 1e-10})
        res = minimize(nll, res.x, method="L-BFGS-B")
        if best is None or res.fun < best.fun:
            best = res
    r, alpha, a, b = np.exp(best.x)
    ll = float(log_likelihood(np.exp(best.x), k, *data).sum())
    return CNBDFit(k, r, alpha, a, b, ll)


def fit(summary: pd.DataFrame, max_k: int = 6, penalizer: float = 0.001) -> tuple[CNBDFit, pd.DataFrame]:
    """Fit k = 1..max_k and keep the highest likelihood. Returns the fit and the k table."""
    fits = [fit_k(summary, k, penalizer) for k in range(1, max_k + 1)]
    table = pd.DataFrame({"k": [f.k for f in fits], "log_likelihood": [f.log_likelihood for f in fits]})
    return max(fits, key=lambda f: f.log_likelihood), table


def probability_alive(model: CNBDFit, summary: pd.DataFrame) -> pd.Series:
    """P(still active at T) = active part / total likelihood."""
    active, dropped = _log_terms(model.params, model.k, *_arrays(summary))
    return pd.Series(np.exp(active - np.logaddexp(active, dropped)), index=summary.index)


def simulate_visits(model: CNBDFit, summary: pd.DataFrame, horizons_weeks: list[float],
                    draws: int = 2000, seed: int = 0) -> pd.DataFrame:
    """Expected visit weeks within each horizon (columns), per customer, by posterior simulation."""
    rng = np.random.default_rng(seed)
    k, (r, alpha, a, b) = model.k, model.params
    x, t_x, T, litt = _arrays(summary)
    n = len(x)
    horizons = np.asarray(horizons_weeks, dtype=float)
    out = np.zeros((n, len(horizons)))

    active, dropped = _log_terms(model.params, k, x, t_x, T, litt)
    p_alive = np.exp(active - np.logaddexp(active, dropped))
    u = T - t_x
    i = np.arange(k)[:, None]
    shape = r + k * x + i
    with np.errstate(divide="ignore"):
        log_u = np.where(u > 0, np.log(np.where(u > 0, u, 1.0)), -np.inf)
    w = gammaln(shape) - shape * np.log(alpha + T) + np.where(i == 0, 0.0, i * log_u) - gammaln(i + 1)
    w = np.exp(w - logsumexp(w, axis=0))  # (k, n): P(i phases done | active)

    for c in range(n):
        alive = rng.random(draws) < p_alive[c]
        m = int(alive.sum())
        if m == 0:
            continue
        phases = rng.choice(k, size=m, p=w[:, c])
        lam = rng.gamma(r + k * x[c] + phases, 1.0 / (alpha + T[c]))
        p = rng.beta(a, b + x[c] + 1, size=m)
        t = rng.gamma(k - phases, 1.0 / lam)  # time to the next visit from now
        counts = np.zeros((m, len(horizons)))
        active_now = np.ones(m, dtype=bool)
        while True:
            live = active_now & (t <= horizons[-1])
            if not live.any():
                break
            counts[live] += (t[live, None] <= horizons[None, :])
            # after each visit: drop out with p, else wait another Erlang-k gap
            active_now = live & (rng.random(m) >= p)
            t = np.where(active_now, t + rng.gamma(k, 1.0 / lam), np.inf)
        out[c] = counts.sum(axis=0) / draws
    return pd.DataFrame(out, index=summary.index, columns=list(horizons_weeks))


def clv(model: CNBDFit, spend_per_visit: pd.Series, summary: pd.DataFrame, months: int = 12,
        monthly_discount: float = 0.01, draws: int = 2000, seed: int = 0) -> pd.Series:
    """Discounted expected revenue over `months` (as clv.clv), visits from simulate_visits."""
    weeks_per_month = 4.345
    horizons = [m * weeks_per_month for m in range(1, months + 1)]
    cumulative = simulate_visits(model, summary, horizons, draws, seed).to_numpy()
    monthly = np.diff(np.hstack([np.zeros((len(summary), 1)), cumulative]), axis=1)
    discount = (1 + monthly_discount) ** -np.arange(1, months + 1)
    return pd.Series((monthly * discount).sum(axis=1), index=summary.index) * spend_per_visit
