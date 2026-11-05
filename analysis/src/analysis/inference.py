"""Statistical inference for the descriptive claims: intervals and tests (notebooks/04).

A difference seen in a sample isn't a finding until it's tested: with 100–400
customers per group, rates move by several points by chance alone. These
helpers attach confidence intervals and tests to the tables the notebooks show:

* wilson_ci: interval for a proportion (better than the normal approximation
  for small n or rates near 0 / 1)
* chi_square: test of independence on a contingency table, with the expected
  count check (Cochran: all expected ≥ 1, at least 80% ≥ 5), falling back to
  Fisher's exact test for a 2 × 2 table that fails it
* compare_spend: Welch's t-test and Mann–Whitney U (spend is skewed, so the
  rank test is the one to trust), with a bootstrap CI for the difference
* km_medians: Kaplan–Meier median gap per group with its 95% CI
* concentration: share of revenue from the top customers, Lorenz curve, Gini
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from lifelines import KaplanMeierFitter
from lifelines.utils import median_survival_times
from scipy import stats


def wilson_ci(successes: int | np.ndarray, n: int | np.ndarray, level: float = 0.95) -> tuple[np.ndarray, np.ndarray]:
    """Wilson score interval for successes / n (vectorised). n = 0 gives NaN."""
    z = stats.norm.ppf(0.5 + level / 2)
    k, n = np.asarray(successes, dtype=float), np.asarray(n, dtype=float)
    with np.errstate(invalid="ignore", divide="ignore"):
        p = k / n
        centre = (p + z**2 / (2 * n)) / (1 + z**2 / n)
        half = z * np.sqrt(p * (1 - p) / n + z**2 / (4 * n**2)) / (1 + z**2 / n)
    return centre - half, centre + half


def rate_table(flags: pd.Series, groups: pd.Series, level: float = 0.95) -> pd.DataFrame:
    """Per group: n, successes, rate and its Wilson interval."""
    data = pd.DataFrame({"y": flags.astype(bool), "g": groups}).dropna()
    t = data.groupby("g")["y"].agg(n="size", successes="sum")
    t["rate"] = t["successes"] / t["n"]
    t["ci_low"], t["ci_high"] = wilson_ci(t["successes"].to_numpy(), t["n"].to_numpy(), level)
    return t


def chi_square(table: pd.DataFrame) -> dict:
    """Chi-square test of independence, with its assumptions checked.

    Cramér's V gives the effect size (0 = none, 1 = perfect association).
    When a 2 × 2 table fails the expected-count rule, Fisher's exact test is
    used instead; a larger table that fails it is reported with
    `assumptions_ok` False, so its p-value should be read with care.
    """
    t = table.loc[table.sum(axis=1) > 0, table.sum(axis=0) > 0]
    chi2, p, dof, expected = stats.chi2_contingency(t, correction=False)
    ok = bool((expected >= 1).all() and (expected >= 5).mean() >= 0.8)
    n = t.to_numpy().sum()
    v = float(np.sqrt(chi2 / (n * (min(t.shape) - 1)))) if min(t.shape) > 1 else np.nan
    out = {"test": "chi-square", "statistic": float(chi2), "dof": int(dof), "p_value": float(p),
           "cramers_v": v, "min_expected": float(expected.min()), "assumptions_ok": ok, "n": int(n)}
    if not ok and t.shape == (2, 2):
        _, p_exact = stats.fisher_exact(t.to_numpy())
        out.update(test="Fisher exact", p_value=float(p_exact), assumptions_ok=True)
    return out


def compare_spend(a: pd.Series, b: pd.Series, n_boot: int = 2000, seed: int = 0) -> dict:
    """Two groups of spend: means, Welch t-test, Mann–Whitney U, bootstrap CI of mean(a) − mean(b)."""
    a, b = a.dropna().to_numpy(float), b.dropna().to_numpy(float)
    rng = np.random.default_rng(seed)
    diffs = [rng.choice(a, len(a)).mean() - rng.choice(b, len(b)).mean() for _ in range(n_boot)]
    welch = stats.ttest_ind(a, b, equal_var=False)
    mw = stats.mannwhitneyu(a, b, alternative="two-sided")
    return {"n_a": len(a), "n_b": len(b), "mean_a": a.mean(), "mean_b": b.mean(),
            "median_a": float(np.median(a)), "median_b": float(np.median(b)),
            "diff_mean": a.mean() - b.mean(), "diff_ci_low": float(np.percentile(diffs, 2.5)),
            "diff_ci_high": float(np.percentile(diffs, 97.5)),
            "welch_p": float(welch.pvalue), "mannwhitney_p": float(mw.pvalue)}


def km_medians(gaps: pd.DataFrame, by: str = "category") -> pd.DataFrame:
    """Kaplan–Meier median gap (days) per group with its 95% CI (NaN when not reached)."""
    rows = {}
    for group, g in gaps.groupby(by):
        kmf = KaplanMeierFitter().fit(g["gap_days"], g["event"])
        ci = median_survival_times(kmf.confidence_interval_)
        rows[group] = {"gaps": len(g), "median_days": kmf.median_survival_time_,
                       "ci_low": float(ci.iloc[0, 0]), "ci_high": float(ci.iloc[0, 1])}
    return pd.DataFrame(rows).T


def concentration(revenue: pd.Series, top_shares: tuple[float, ...] = (0.1, 0.2, 0.5)) -> dict:
    """How concentrated revenue is across customers.

    Gini: 0 = everyone spends the same, 1 = one customer brings everything.
    `lorenz` is (share of customers, share of revenue), poorest first.
    """
    x = np.sort(revenue.dropna().clip(lower=0).to_numpy(float))
    n, total = len(x), x.sum()
    cum = np.cumsum(x) / total
    lorenz = pd.DataFrame({"customers": np.arange(1, n + 1) / n, "revenue": cum})
    gini = 1 - 2 * np.trapezoid(np.concatenate([[0], cum]), np.concatenate([[0], lorenz["customers"]]))
    tops = {f"top_{int(s * 100)}pct_share": float(x[::-1][: int(np.ceil(n * s))].sum() / total) for s in top_shares}
    return {"customers": n, "gini": float(gini), **tops, "lorenz": lorenz}
