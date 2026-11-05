"""What did customers actually pay, against the list price? (notebooks/04)

`list_price` mirrors the app's current rules (src/constants/services.ts
defaultPriceFor and src/utils/topUpPrice.ts), which are the studio's newest
price list (confirmed by the studio). Bookings so far were mostly charged the
old prices ($200 整甲, $380 眼睫毛, $580 整甲 + 眼睫毛, add-ons free), so the
gap measures how far the new list has taken hold; the regression's year
effects show the old prices hadn't moved since 2023. CLV and the revenue
forecast use 收費 as charged, so they move to the new prices on their own.

* realisation: per service and year, the share of bookings at the list price
  and the mean difference
* price_regression: OLS of 收費 on service and year dummies (full sets, 手),
  and on the add-ons for the years they're recorded (2025 on), whose
  coefficients can be read against the list's +$60 / +$120 / +$100 / $0
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

# src/constants/services.ts (price; priceByHandOrFoot for 整甲)
BASE_PRICE = {"整甲": 218, "眼睫毛": 428, "整甲 + 眼睫毛": 646, "補甲": 30, "拆甲": 100,
              "補眼睫毛": 428, "拆眼睫毛": 100, "粉嫩術": 2000}
NAIL_HAND_FOOT_PRICE = {"手": 218, "腳": 298, "手 + 腳": 516}
COMPLEX_PRICE = {"半個鐘": 60, "一個鐘": 120}
EXTENSION_PRICE = 100
REMOVAL_PRICE = 0
# src/utils/topUpPrice.ts: (full sets it tops up, [(within days, price)], full price)
TOP_UP_TIERS = {
    "補眼睫毛": ({"眼睫毛", "整甲 + 眼睫毛"}, [(5, 0), (14, 214)], 428),
    "補甲": ({"整甲", "整甲 + 眼睫毛"}, [(5, 0)], 30),
}
NAIL_SERVICES = {"整甲", "整甲 + 眼睫毛"}


def list_price(visits: pd.DataFrame) -> pd.Series:
    """Today's list price for each booking row (NaN for services without one)."""
    v = visits
    price = v["service"].map(BASE_PRICE).astype(float)
    nails = v["service"].isin(NAIL_SERVICES)
    hand_foot = v["hand_foot"].where(v["hand_foot"].isin(NAIL_HAND_FOOT_PRICE), "手")
    nail_base = hand_foot.map(NAIL_HAND_FOOT_PRICE) + np.where(v["service"] == "整甲 + 眼睫毛", BASE_PRICE["眼睫毛"], 0)
    price = price.where(~nails, nail_base)
    extras = (v["complex_design"].map(COMPLEX_PRICE).fillna(0)
              + v["extension"].fillna(False).astype(bool) * EXTENSION_PRICE
              + v["removal"].fillna(False).astype(bool) * REMOVAL_PRICE)
    price = price + np.where(nails & (hand_foot != "腳"), extras, 0)

    # Top-ups: priced from the customer's last full set before the booking
    for service, (sets, tiers, full) in TOP_UP_TIERS.items():
        rows = v.index[v["service"] == service]
        if len(rows) == 0:
            continue
        set_dates = v.loc[v["service"].isin(sets), ["customer_id", "date"]]
        for i in rows:
            earlier = set_dates[(set_dates["customer_id"] == v.at[i, "customer_id"]) & (set_dates["date"] <= v.at[i, "date"])]
            price.at[i] = full
            if len(earlier):
                gap = (v.at[i, "date"] - earlier["date"].max()).days
                for within, tier_price in tiers:
                    if gap <= within:
                        price.at[i] = tier_price
                        break
    return price


def realisation(visits: pd.DataFrame) -> pd.DataFrame:
    """Per service and year: bookings with a known price, share at list, mean paid − list."""
    v = visits.dropna(subset=["price"]).assign(list_price=lambda d: list_price(d))
    v = v.dropna(subset=["list_price"])
    v["diff"] = v["price"] - v["list_price"]
    g = v.groupby(["service", v["date"].dt.year.rename("year")])
    return pd.DataFrame({"bookings": g.size(), "share_at_list": g["diff"].agg(lambda d: (d == 0).mean()),
                         "share_below": g["diff"].agg(lambda d: (d < 0).mean()),
                         "mean_paid": g["price"].mean(), "mean_list": g["list_price"].mean(),
                         "mean_diff": g["diff"].mean()}).query("bookings >= 10")


def price_regression(visits: pd.DataFrame):
    """Two OLS fits with robust (HC3) standard errors.

    1. all years, full sets for 手: price ~ service + year (what changed over time)
    2. 2025 on, 整甲 / 整甲 + 眼睫毛 for 手: price ~ service + 複雜款 + 延長 + 拆甲
       (what each add-on really adds, against the list)
    """
    full = visits[visits["service"].isin(["整甲", "眼睫毛", "整甲 + 眼睫毛"]) & (visits["hand_foot"] == "手")
                  & visits["price"].notna() & (visits["date"].dt.year >= 2023)].copy()
    full["year"] = full["date"].dt.year.astype(str)
    by_year = smf.ols("price ~ C(service, Treatment('整甲')) + C(year, Treatment('2023'))", data=full).fit(cov_type="HC3")

    nails = visits[visits["service"].isin(NAIL_SERVICES) & (visits["hand_foot"] == "手")
                   & visits["price"].notna() & (visits["date"] >= pd.Timestamp("2025-01-01"))
                   & visits["removal"].notna()].copy()
    nails["half_hour_design"] = (nails["complex_design"] == "半個鐘").astype(int)
    nails["hour_design"] = (nails["complex_design"] == "一個鐘").astype(int)
    nails["extension_"] = nails["extension"].fillna(False).astype(int)
    nails["removal_"] = nails["removal"].fillna(False).astype(int)
    nails["with_lashes"] = (nails["service"] == "整甲 + 眼睫毛").astype(int)
    add_ons = smf.ols("price ~ with_lashes + half_hour_design + hour_design + extension_ + removal_",
                      data=nails).fit(cov_type="HC3")
    return by_year, add_ons
