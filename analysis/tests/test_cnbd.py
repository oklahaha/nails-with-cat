import numpy as np
import pandas as pd
import pytest
from lifetimes import ModifiedBetaGeoFitter

from analysis import cnbd


def _summary(rng, n=600, k=3, r=3.0, alpha=6.0, a=0.6, b=2.5, T_max=80.0):
    """Customers simulated from MBG/CNBD-k itself (weeks)."""
    rows = []
    for i in range(n):
        lam, p = rng.gamma(r, 1 / alpha), rng.beta(a, b)
        T = rng.uniform(10, T_max)
        t, times = 0.0, []
        alive = rng.random() >= p  # MBG: may drop out right after the first visit
        while alive:
            t += rng.gamma(k, 1 / lam)
            if t > T:
                break
            times.append(t)
            alive = rng.random() >= p
        gaps = np.diff([0.0, *times])
        rows.append({"frequency": float(len(times)), "recency": times[-1] if times else 0.0, "T": T,
                     "litt": float(np.log(gaps).sum()) if len(times) else 0.0})
    return pd.DataFrame(rows)


def test_k1_is_mbgnbd():
    rng = np.random.default_rng(1)
    s = _summary(rng, k=1)
    lt = ModifiedBetaGeoFitter(penalizer_coef=0.0).fit(s["frequency"], s["recency"], s["T"])
    params = np.array([lt.params_[c] for c in ("r", "alpha", "a", "b")])
    model = cnbd.CNBDFit(1, *params, 0.0)
    expected = lt.conditional_probability_alive(s["frequency"].to_numpy(), s["recency"].to_numpy(), s["T"].to_numpy())
    np.testing.assert_allclose(cnbd.probability_alive(model, s), expected, rtol=1e-8)
    # Simulated expected visits agree with the closed form for k = 1
    sim = cnbd.simulate_visits(model, s, [26.0], draws=4000)[26.0]
    closed = lt.conditional_expected_number_of_purchases_up_to_time(26, s["frequency"].to_numpy(),
                                                                    s["recency"].to_numpy(), s["T"].to_numpy())
    assert sim.sum() == pytest.approx(np.sum(closed), rel=0.03)


def test_fit_recovers_regularity():
    s = _summary(np.random.default_rng(2), n=800, k=3)
    best, table = cnbd.fit(s, max_k=5)
    assert best.k in (2, 3, 4)
    assert table.set_index("k").loc[best.k, "log_likelihood"] > table.set_index("k").loc[1, "log_likelihood"]


def test_overdue_regular_is_less_alive_with_erlang_gaps():
    # Same customer under k = 1 and k = 4 with identical rate parameters: 10 visits every 4 weeks,
    # silent for 20 weeks. A regular rhythm makes the silence more telling.
    s = pd.DataFrame({"frequency": [10.0], "recency": [40.0], "T": [60.0], "litt": [10 * np.log(4.0)]})
    p1 = cnbd.probability_alive(cnbd.CNBDFit(1, 2.0, 8.0, 0.5, 3.0, 0.0), s).iloc[0]
    p4 = cnbd.probability_alive(cnbd.CNBDFit(4, 8.0, 8.0, 0.5, 3.0, 0.0), s).iloc[0]
    assert p4 < p1
