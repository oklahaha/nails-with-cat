"""Matplotlib setup shared by the notebooks."""

from __future__ import annotations

import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib import font_manager

# Fonts that draw Traditional Chinese, macOS first; the first one installed is used
CJK_FONTS = ["PingFang HK", "PingFang TC", "Heiti TC", "Noto Sans CJK TC", "Noto Sans TC",
             "Microsoft JhengHei", "WenQuanYi Zen Hei"]


def setup_plots() -> None:
    """Seaborn's clean style, with a font that has the service names' characters."""
    sns.set_theme(style="whitegrid", context="notebook")
    installed = {f.name for f in font_manager.fontManager.ttflist}
    cjk = [name for name in CJK_FONTS if name in installed]
    plt.rcParams["font.sans-serif"] = cjk + plt.rcParams["font.sans-serif"]
    plt.rcParams["axes.unicode_minus"] = False
    plt.rcParams["figure.figsize"] = (10, 4)
    plt.rcParams["figure.dpi"] = 110
