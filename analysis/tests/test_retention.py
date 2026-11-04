import numpy as np
import pandas as pd

from analysis.retention import cohort_retention, first_visits, second_visit_rates
from conftest import make_days


def test_cohort_retention_counts_customers_per_month_and_masks_unfinished_months():
    days = make_days([
        ("a", "2023-01-05", 100), ("a", "2023-02-10", 100), ("a", "2023-02-20", 100),
        ("b", "2023-01-20", 100), ("b", "2023-03-01", 100),
        ("c", "2023-02-01", 100),
    ])
    table = cohort_retention(days, pd.Timestamp("2023-03-15"), max_periods=3)
    jan, feb = pd.Period("2023-01", "M"), pd.Period("2023-02", "M")
    assert table.loc[jan, "customers"] == 2
    assert table.loc[jan, 0] == 1.0
    assert table.loc[jan, 1] == 0.5  # a came twice in Feb but counts once
    # March isn't over on 2023-03-15
    assert np.isnan(table.loc[jan, 2])
    assert table.loc[feb, 1] != table.loc[feb, 1]  # NaN: Feb + 1 = March


def test_second_visit_rates_only_count_customers_with_the_full_window():
    days = make_days([
        ("a", "2023-01-01", 100), ("a", "2023-01-20", 100),  # back in 19 days
        ("b", "2023-01-01", 100), ("b", "2023-03-01", 100),  # back in 59 days
        ("c", "2023-03-20", 100),  # first visit 12 days before the end: not eligible yet
        ("old", "2022-07-20", 100),  # left-truncated cohort
    ])
    firsts = first_visits(days)
    assert firsts.loc["old", "left_truncated"]
    rates = second_visit_rates(firsts, pd.Timestamp("2023-04-01"), windows=(30, 60)).loc["all"]
    assert rates["eligible_30d"] == 2 and rates["rate_30d"] == 0.5
    assert rates["eligible_60d"] == 2 and rates["rate_60d"] == 1.0
