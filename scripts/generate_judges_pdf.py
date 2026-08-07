"""
Generate a print-friendly PDF document for competition judges.
White background, dark text — designed for printing on paper.

Usage: python scripts/generate_judges_pdf.py
Output: judges-document-drive-pulse.pdf in project root
"""

import base64
import io
import os
import textwrap
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np

# ── Print-friendly colour palette ──────────────────────────────────
WHITE       = "#ffffff"
PAGE_BG     = "#ffffff"
CARD_BG     = "#f8f9fa"
BORDER      = "#d1d5db"
BORDER_LIGHT = "#e5e7eb"
TEXT        = "#111827"
TEXT_MUTED  = "#4b5563"
TEXT_DIM    = "#6b7280"
ACCENT_TEAL = "#0d9488"
ACCENT_SKY  = "#0369a1"
ACCENT_LIME = "#4d7c0f"
ACCENT_PEACH = "#be123c"
ACCENT_GRAY = "#6b7280"

OUTPUT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_PATH = OUTPUT_DIR / "judges-document-drive-pulse.pdf"


# ── Chart helpers ───────────────────────────────────────────────────

def _fig_to_b64(fig: plt.Figure) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=200, bbox_inches="tight",
                facecolor=WHITE, edgecolor="none")
    buf.seek(0)
    data = base64.b64encode(buf.read()).decode()
    plt.close(fig)
    return data


def _style_ax(ax: plt.Axes) -> None:
    ax.set_facecolor(WHITE)
    ax.tick_params(colors=TEXT_MUTED, labelsize=9)
    for spine in ax.spines.values():
        spine.set_color(BORDER)
        spine.set_linewidth(0.5)
    ax.title.set_color(TEXT)
    ax.title.set_fontsize(13)
    ax.title.set_fontweight("bold")


def chart_fatalities() -> str:
    """Bar chart: fatalities per 100k population by region."""
    regions = [
        "Ethiopia", "Africa (WHO)", "Southeast Asia",
        "Global avg", "Europe", "Americas",
    ]
    values = [37.0, 27.0, 20.0, 18.2, 9.3, 16.0]
    colors = [ACCENT_PEACH, ACCENT_SKY, ACCENT_SKY, ACCENT_TEAL, ACCENT_GRAY, ACCENT_GRAY]

    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    _style_ax(ax)
    bars = ax.barh(regions[::-1], values[::-1], height=0.55,
                   color=colors[::-1], edgecolor="none")
    for bar, val in zip(bars, reversed(values)):
        ax.text(bar.get_width() + 0.6, bar.get_y() + bar.get_height() / 2,
                f"{val:.0f}", va="center", fontsize=10, fontweight="bold", color=TEXT)
    ax.set_xlim(0, 48)
    ax.set_xlabel("Fatalities per 100 000 population", color=TEXT_DIM, fontsize=9)
    fig.tight_layout()
    return _fig_to_b64(fig)


def chart_phone_risk() -> str:
    """Bar chart: odds ratio of crash when using phone while driving."""
    activities = ["Dialling", "Talking (handheld)", "Reading text", "Sending text", "Reaching for phone"]
    odds = [2.7, 3.1, 4.8, 6.1, 12.2]

    fig, ax = plt.subplots(figsize=(7.2, 3.2))
    _style_ax(ax)
    xs = np.arange(len(activities))
    ax.bar(xs, odds, width=0.55, color=ACCENT_PEACH, edgecolor="none", zorder=3)
    for x, val in zip(xs, odds):
        ax.text(x, val + 0.35, f"{val:.1f}x", ha="center", va="bottom",
                fontsize=10, fontweight="bold", color=TEXT)
    ax.set_xticks(xs)
    ax.set_xticklabels(["\n".join(textwrap.wrap(a, 10)) for a in activities],
                       color=TEXT_MUTED, fontsize=8.5, linespacing=1.2)
    ax.set_ylabel("Odds ratio of crash", color=TEXT_DIM, fontsize=9)
    ax.set_ylim(0, 15)
    ax.yaxis.set_major_locator(mticker.MultipleLocator(3))
    fig.tight_layout()
    return _fig_to_b64(fig)


def chart_project_stats() -> str:
    """Summary metrics for the pilot project."""
    labels = ["Trips\ncaptured", "Sensor\nsamples", "Active\ndrivers",
              "Languages\nsupported", "Event\ntypes", "Model\nversions"]
    values = [50, 144, 6, 3, 6, 4]
    colors = [ACCENT_TEAL, ACCENT_SKY, ACCENT_LIME, ACCENT_PEACH, ACCENT_SKY, ACCENT_TEAL]

    fig, ax = plt.subplots(figsize=(7.2, 3.0))
    _style_ax(ax)
    bars = ax.bar(labels, values, width=0.5, color=colors, edgecolor="none", zorder=3)
    for bar, val in zip(bars, values):
        suffix = "K" if val >= 1000 else ""
        display = f"{val:,}{suffix}" if val < 10000 else f"{val // 1000}K+"
        ax.text(bar.get_x() + bar.get_width() / 2,
                bar.get_height() + max(values) * 0.03,
                display, ha="center", va="bottom", fontsize=11,
                fontweight="bold", color=TEXT)
    ax.set_ylim(0, max(values) * 1.25)
    fig.tight_layout()
    return _fig_to_b64(fig)


def chart_crash_causes() -> str:
    """Bar chart: causes of road fatalities."""
    causes = ["Speeding /\nreckless", "Phone\ndistraction", "Drunk /\nimpaired",
              "Poor road\ninfrastructure", "Vehicle\ndefects"]
    values = [38, 22, 18, 14, 8]
    colors = [ACCENT_PEACH, ACCENT_TEAL, ACCENT_SKY, ACCENT_LIME, ACCENT_GRAY]

    fig, ax = plt.subplots(figsize=(7.2, 3.0))
    _style_ax(ax)
    bars = ax.bar(causes, values, width=0.5, color=colors, edgecolor="none", zorder=3)
    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.8,
                f"{val}%", ha="center", va="bottom", fontsize=11,
                fontweight="bold", color=TEXT)
    ax.set_ylim(0, 48)
    fig.tight_layout()
    return _fig_to_b64(fig)


def chart_gdp_impact() -> str:
    """Bar chart: GDP impact by region."""
    regions = ["LMICs\n(Ethiopia ~3.5%)", "LMICs\n(global avg)", "High-income\ncountries"]
    values = [3.5, 3.0, 1.0]
    colors = [ACCENT_PEACH, ACCENT_TEAL, ACCENT_GRAY]

    fig, ax = plt.subplots(figsize=(7.2, 2.8))
    _style_ax(ax)
    bars = ax.bar(regions, values, width=0.45, color=colors, edgecolor="none", zorder=3)
    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.08,
                f"{val:.1f}%", ha="center", va="bottom", fontsize=11,
                fontweight="bold", color=TEXT)
    ax.set_ylim(0, 4.5)
    ax.set_ylabel("% of GDP lost", color=TEXT_DIM, fontsize=9)
    fig.tight_layout()
    return _fig_to_b64(fig)


# ── HTML Template ────────────────────────────────────────────────────

HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page {{ margin: 0; size: A4; }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
    background: {bg};
    color: {text};
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }}

  .cover {{
    position: relative; height: 297mm;
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
    text-align: center; background: {bg};
    page-break-after: always;
    border-bottom: 4px solid {teal};
  }}
  .cover-accent {{ width: 80px; height: 4px; background: {teal}; margin-bottom: 32px; border-radius: 2px; }}
  .cover h1 {{ font-size: 52px; font-weight: 700; letter-spacing: -1px; color: {text}; }}
  .cover .tagline {{ font-size: 16px; letter-spacing: 6px; text-transform: uppercase; color: {dim}; margin-top: 10px; }}
  .cover .subtitle {{ margin-top: 36px; font-size: 20px; color: {muted}; max-width: 520px; line-height: 1.7; }}
  .cover .meta {{ margin-top: 60px; font-size: 13px; color: {dim}; display: flex; gap: 32px; flex-wrap: wrap; justify-content: center; }}
  .cover .meta span {{ padding: 6px 18px; border: 1px solid {border}; border-radius: 4px; background: {card}; }}

  .page {{ padding: 32px 40px; page-break-after: always; }}
  h2 {{ font-size: 22px; font-weight: 700; margin-bottom: 8px; color: {text}; border-bottom: 2px solid {teal}; padding-bottom: 5px; }}
  h3 {{ font-size: 15px; font-weight: 600; margin: 14px 0 6px; color: {text}; }}
  p {{ font-size: 12.5px; color: {muted}; margin-bottom: 8px; line-height: 1.65; }}
  p strong {{ color: {text}; }}

  .stat-row {{ display: flex; gap: 10px; margin: 12px 0; flex-wrap: wrap; }}
  .stat-card {{
    flex: 1; min-width: 90px;
    background: {card}; border: 1px solid {border};
    border-radius: 6px; padding: 12px 10px; text-align: center;
  }}
  .stat-card .num {{ font-size: 24px; font-weight: 700; color: {teal}; display: block; }}
  .stat-card .label {{ font-size: 10px; color: {dim}; margin-top: 2px; line-height: 1.3; }}
  .stat-card.accent-sky .num {{ color: {sky}; }}
  .stat-card.accent-lime .num {{ color: {lime}; }}
  .stat-card.accent-peach .num {{ color: {peach}; }}

  .chart {{ margin: 10px 0; text-align: center; }}
  .chart img {{ max-width: 100%; border: 1px solid {border_light}; border-radius: 4px; }}

  .callout {{
    background: {card}; border-left: 3px solid {teal};
    border-radius: 4px; padding: 10px 14px; margin: 10px 0;
  }}
  .callout p {{ margin-bottom: 0; font-size: 12px; }}
  .callout.peach {{ border-left-color: {peach}; }}
  .callout.sky {{ border-left-color: {sky}; }}

  .two-col {{ display: flex; gap: 16px; margin: 10px 0; }}
  .two-col > div {{ flex: 1; }}

  ul {{ list-style: none; padding: 0; margin: 4px 0; }}
  li {{
    font-size: 12px; color: {muted}; padding: 3px 0 3px 16px;
    position: relative; line-height: 1.5;
  }}
  li::before {{ content: '\\25B8'; position: absolute; left: 0; color: {teal}; font-weight: bold; }}

  .badge {{
    display: inline-block; padding: 2px 8px; border-radius: 3px;
    font-size: 10px; font-weight: 600;
    background: {card}; border: 1px solid {border}; color: {muted};
  }}

  .divider {{ height: 1px; background: {border}; margin: 14px 0; }}
  .footer {{ text-align: center; padding: 14px 0 4px; font-size: 10px; color: {dim}; }}
  .final-note {{ text-align: center; margin-top: 24px; color: {dim}; font-size: 13px; font-style: italic; }}

  table {{ width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; }}
  th {{ text-align: left; padding: 6px 10px; color: {text}; font-weight: 600; border-bottom: 2px solid {border}; background: {card}; }}
  td {{ padding: 6px 10px; color: {muted}; border-bottom: 1px solid {border_light}; }}

  @media print {{ .page {{ padding: 28px 36px; }} }}
</style>
</head>
<body>

<!-- ═══════════ COVER PAGE ═══════════ -->
<div class="cover">
  <div class="cover-accent"></div>
  <p style="font-size: 15px; color: #6b7280; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 20px;">Team VisionZero</p>
  <h1>Drive Pulse</h1>
  <div class="tagline">Driver Intelligence</div>
  <p class="subtitle">
    Turning smartphone sensors into road safety intelligence &mdash;<br>
    for drivers, fleets, and communities<br>
    <span style="font-size: 16px; color: #0d9488; display: inline-block; margin-top: 8px;">Team VisionZero &middot; Abune Gorgorios Schools Kality</span>
  </p>
  <div class="meta">
    <span>July 2026</span>
    <span>Competition Submission</span>
    <span>Version 1.0</span>
  </div>
  <div style="margin-top: 40px; padding: 20px 28px; border: 1px solid #d1d5db; border-radius: 8px; background: #f8f9fa; max-width: 460px;">
    <p style="font-size: 13px; color: #4b5563; margin-bottom: 10px; font-weight: 600;">Abune Gorgorios Schools &mdash; Kality</p>
    <p style="font-size: 13px; color: #6b7280; line-height: 1.8;">
      Kidus Sofonias &middot; Bersan Mekonnen &middot; Eliana Girma &middot; Ahadu WeldeSenbet
    </p>
  </div>
</div>

<!-- ═══════════ 1. EXECUTIVE SUMMARY ═══════════ -->
<div class="page">
  <h2>Executive Summary</h2>

  <p>
    Every year, <strong>1.16 million people</strong> die on the world's roads &mdash; one death every 27 seconds. Road traffic injuries are the <strong>leading cause of death for people aged 5 to 29</strong>, and 90% of these fatalities occur in low- and middle-income countries (LMICs). Ethiopia, with a fatality rate of <strong>37 per 100,000 population</strong> &mdash; more than double the global average of 18.2 &mdash; sits at the epicentre of this crisis.
  </p>

  <p>
    The primary causes &mdash; speeding (38%), phone distraction (22%), and impaired driving (18%) &mdash; are behavioural, not infrastructural. Yet existing solutions remain out of reach: traditional telematics cost $100&ndash;500 per vehicle plus monthly fees, while insurance black boxes offer no driver feedback and raise privacy concerns.
  </p>

  <p>
    <strong>Drive Pulse</strong> offers a radically different approach. It turns a standard smartphone into a professional driving safety tool using the sensors already inside &mdash; GPS, accelerometer, and gyroscope. <strong>Zero extra hardware. No installation costs. No subscription barriers.</strong> With smartphone penetration in Africa set to reach 88% by 2030, the hardware is already in people's pockets. Drive Pulse is the software that makes it work.
  </p>

  <div class="callout">
    <p><strong>What we have built:</strong> A complete, deployed production system &mdash; React Native mobile app, FastAPI backend, PostgreSQL database on Supabase, ML pipeline with rule-based scoring, all live on Render. <strong>50+ pilot trips captured, 144,000+ sensor samples collected, 6 driving event types detected, 3 languages supported.</strong></p>
  </div>

  <div class="divider"></div>
  <div class="footer">Drive Pulse &middot; Executive Summary &middot; July 2026</div>
</div>

<!-- ═══════════ 2. THE SCALE OF THE CRISIS ═══════════ -->
<div class="page">
  <h2>The Scale of the Crisis</h2>

  <div class="stat-row">
    <div class="stat-card"><span class="num">1.16M</span><span class="label">Annual road deaths globally</span></div>
    <div class="stat-card accent-sky"><span class="num">90%</span><span class="label">Deaths in low/middle-income countries</span></div>
    <div class="stat-card accent-peach"><span class="num">#1</span><span class="label">Cause of death for ages 5&ndash;29</span></div>
    <div class="stat-card"><span class="num">3%</span><span class="label">of GDP lost to crashes in LMICs</span></div>
  </div>

  <p>
    The World Health Organization estimates <strong>1.16 million road traffic deaths</strong> occur annually &mdash; a death every 27 seconds. The burden is profoundly unequal: <strong>low- and middle-income countries</strong> account for 90% of these fatalities while owning just 60% of the world's vehicles. The African region has the highest road traffic fatality rates on the planet.
  </p>

  <div class="chart">
    <img src="data:image/png;base64,{chart_fatalities}" alt="Fatality rates by region">
  </div>

  <p>
    Beyond the human toll, the economic cost is staggering. Road crashes cost LMICs an estimated <strong>3% of their GDP annually</strong> &mdash; money lost to medical expenses, lost productivity, property damage, and insurance administration. For Ethiopia, that figure is likely higher, draining hundreds of millions of dollars from the economy each year.
  </p>

  <div class="chart">
    <img src="data:image/png;base64,{chart_gdp}" alt="GDP impact comparison">
  </div>

  <div class="divider"></div>
  <div class="footer">Drive Pulse &middot; The Scale of the Crisis &middot; July 2026</div>
</div>

<!-- ═══════════ 3. WHO IS AFFECTED ═══════════ -->
<div class="page">
  <h2>Who Is Affected</h2>

  <p>
    Road crashes do not affect everyone equally. The burden falls disproportionately on <strong>young people, men, pedestrians, and the economically vulnerable</strong> &mdash; precisely the groups that low-income countries can least afford to lose.
  </p>

  <div class="stat-row">
    <div class="stat-card accent-peach"><span class="num">37</span><span class="label">Ethiopia fatalities / 100k pop.</span></div>
    <div class="stat-card"><span class="num">4,922</span><span class="label">Fatalities per 100k vehicles</span></div>
    <div class="stat-card accent-sky"><span class="num">30%</span><span class="label">Pedestrian fatalities</span></div>
    <div class="stat-card accent-lime"><span class="num">16%</span><span class="label">Motorcyclist fatalities</span></div>
  </div>

  <h3>Ethiopia: A Closer Look</h3>
  <p>
    Ethiopia's road fatality rate of <strong>37 per 100,000 population</strong> is more than double the global average of 18.2. When adjusted for the number of registered vehicles, the rate skyrockets to approximately <strong>4,922 fatalities per 100,000 vehicles</strong> &mdash; a figure that highlights just how dangerous the roads are for everyone sharing them.
  </p>

  <p>
    <strong>Young adults aged 15 to 29</strong> are at the highest risk, representing the most economically productive segment of the population. Pedestrians account for roughly 30% of fatalities, reflecting the reality that in many Ethiopian cities, walking is the primary mode of transport. Motorcyclists, a rapidly growing group as motorcycle taxis become ubiquitous, account for another 16% of deaths.
  </p>

  <h3>The Distraction Epidemic</h3>
  <p>
    Phone use while driving is not a minor factor &mdash; it is a <strong>major and growing cause of crashes</strong>. Research from multiple controlled studies shows that the simple act of using a phone while driving dramatically increases crash risk:
  </p>

  <div class="chart">
    <img src="data:image/png;base64,{chart_phone}" alt="Phone use crash risk">
  </div>

  <p>
    Critically, <strong>reaching for a phone</strong> &mdash; not even using it &mdash; increases crash risk by <strong>12.2 times</strong>. This means that the temptation to check a notification, even briefly, can have devastating consequences. With smartphone penetration in Africa projected to reach <strong>88% by 2030</strong>, this danger is accelerating rapidly.
  </p>

  <div class="divider"></div>
  <div class="footer">Drive Pulse &middot; Who Is Affected &middot; July 2026</div>
</div>

<!-- ═══════════ 4. WHY EXISTING SOLUTIONS DON'T WORK ═══════════ -->
<div class="page">
  <h2>Why Existing Solutions Don't Work</h2>

  <p>
    The market already has road safety technologies, but they share a fundamental flaw: <strong>they are designed for high-income countries and high-income consumers.</strong> For the drivers and fleet operators who need them most in Ethiopia and across Africa, these solutions remain out of reach.
  </p>

  <h3>Traditional Telematics</h3>
  <p>
    Professional telematics systems cost <strong>$100&ndash;$500 per vehicle</strong> for the hardware alone, plus monthly subscription fees ranging from $20 to $50 per vehicle. They require <strong>professional installation</strong> and ongoing maintenance. For a small fleet of 10 vehicles, that is an upfront cost of $1,000&ndash;$5,000 before any monthly fees. Most Ethiopian fleet operators and individual drivers simply cannot afford this.
  </p>

  <h3>Insurance Black Boxes</h3>
  <p>
    Insurance companies offer "black box" devices that monitor driving behaviour in exchange for potential premium discounts. These devices are <strong>tied to specific insurers</strong>, meaning the driver cannot switch providers without losing the device. They raise legitimate <strong>privacy concerns</strong> &mdash; the driver has no control over what data is collected or how it is used. And critically, they provide <strong>no real-time or post-trip feedback</strong> to the driver, offering no opportunity for learning or behaviour change.
  </p>

  <h3>Phone-Based Apps (Current)</h3>
  <p>
    Existing smartphone apps either rely on manual logging (which is unreliable and easy to fake), require constant internet connectivity (which is not available on many Ethiopian roads), or lack any meaningful scoring or feedback system. None combine <strong>automated sensor capture, ML-powered analysis, plain-language feedback, multilingual support, and fleet management</strong> in a single integrated platform.
  </p>

  <div class="callout">
    <p><strong>The gap is clear:</strong> Existing solutions are either too expensive, too intrusive, too limited, or not designed for the markets that need them most. Meanwhile, smartphone penetration in Africa will reach 88% by 2030 &mdash; and every phone already has the sensors needed to monitor driving behaviour.</p>
  </div>

  <div class="chart">
    <img src="data:image/png;base64,{chart_causes}" alt="Crash causes breakdown">
  </div>

  <p>
    The data shows that <strong>behavioural factors</strong> &mdash; speeding, distraction, and impairment &mdash; account for nearly 80% of crash causes. These are precisely the behaviours that real-time monitoring and feedback can address. The technology exists. The hardware is already in people's pockets. The missing piece was the right software, designed for the right context.
  </p>

  <div class="divider"></div>
  <div class="footer">Drive Pulse &middot; Why Existing Solutions Don't Work &middot; July 2026</div>
</div>

<!-- ═══════════ 5. A DIFFERENT APPROACH ═══════════ -->
<div class="page">
  <h2>A Different Approach: Drive Pulse</h2>

  <p>
    Drive Pulse was built from the ground up with a single question: <strong>What if every smartphone could be a driving safety coach?</strong> The answer is a platform that combines mobile sensing, cloud-based AI, and human-centred design into a tool that works for drivers and fleet operators alike.
  </p>

  <div class="callout">
    <p><strong>Drive Pulse</strong> turns a standard smartphone into a professional-grade driving safety tool. <strong>No extra hardware. No installation. No subscription barriers.</strong> Just a phone, an app, and the commitment to drive safer.</p>
  </div>

  <div class="stat-row">
    <div class="stat-card"><span class="num" style="font-size:17px">Zero Hardware</span><span class="label">Just a smartphone</span></div>
    <div class="stat-card accent-sky"><span class="num" style="font-size:17px">3 Languages</span><span class="label">English, Amharic, Oromo</span></div>
    <div class="stat-card accent-lime"><span class="num" style="font-size:17px">AI + Rules</span><span class="label">Always produces a score</span></div>
    <div class="stat-card accent-peach"><span class="num" style="font-size:17px">Fleet-Ready</span><span class="label">Driver management + review</span></div>
  </div>

  <div class="two-col">
    <div>
      <h3>For Drivers</h3>
      <ul>
        <li>One-tap trip start &amp; end with real-time sensor capture</li>
        <li>Safety score (0&ndash;100) with confidence band</li>
        <li>Plain-language reasons &mdash; not just raw model output</li>
        <li>Driving event detection: hard braking, sharp turns, unstable motion</li>
        <li>Trip history with route playback on a map</li>
        <li>Works in English, Amharic, and Oromo</li>
      </ul>
    </div>
    <div>
      <h3>For Fleet Operators</h3>
      <ul>
        <li>Driver list, trip history, and score trends</li>
        <li>Flagged trip review with events, confidence, and route map</li>
        <li>Human labelling that feeds back into the AI model</li>
        <li>Role-based access control &mdash; admin capabilities are restricted</li>
        <li>Driver credential management and account deletion</li>
      </ul>
    </div>
  </div>

  <h3>How It Works</h3>
  <ol style="margin: 8px 0 8px 20px; font-size: 12.5px; color: {muted}; line-height: 1.8;">
    <li><strong>Start Trip</strong> &mdash; The driver opens the app and taps to begin a live trip session.</li>
    <li><strong>Collect Sensor Data</strong> &mdash; GPS, accelerometer, and gyroscope capture movement quality, instability, acceleration patterns, and route behaviour.</li>
    <li><strong>Upload Samples</strong> &mdash; Buffered sensor bursts sync to the backend with status-aware upload handling, even on spotty connections.</li>
    <li><strong>AI Analysis</strong> &mdash; The backend runs ML models and rule-based checks to classify driving behaviour with confidence.</li>
    <li><strong>Safety Score &amp; Insights</strong> &mdash; Drivers and reviewers receive a score, risk level, event markers, and plain-language reasons.</li>
  </ol>

  <div class="divider"></div>
  <div class="footer">Drive Pulse &middot; A Different Approach &middot; July 2026</div>
</div>

<!-- ═══════════ 6. PROOF OF CONCEPT ═══════════ -->
<div class="page">
  <h2>Proof of Concept</h2>
  <p>
    Drive Pulse is not a concept or a prototype. It is a <strong>deployed, functioning production system</strong> that has been tested with real drivers on real Ethiopian roads. Our pilot has produced measurable results that validate both the technical approach and the real-world impact.
  </p>

  <div class="stat-row">
    <div class="stat-card"><span class="num">50+</span><span class="label">Trips captured and scored</span></div>
    <div class="stat-card accent-sky"><span class="num">144K+</span><span class="label">Sensor samples collected</span></div>
    <div class="stat-card accent-lime"><span class="num">6</span><span class="label">Active driver accounts</span></div>
    <div class="stat-card accent-peach"><span class="num">6</span><span class="label">Driving event types detected</span></div>
  </div>

  <div class="chart">
    <img src="data:image/png;base64,{chart_project}" alt="Project statistics">
  </div>

  <h3>Infrastructure Status</h3>
  <table>
    <tr><th>Component</th><th>Technology</th><th>Status</th></tr>
    <tr><td>Backend API</td><td>FastAPI on Render</td><td><strong style="color:#0d9488">Live</strong></td></tr>
    <tr><td>Database</td><td>PostgreSQL via Supabase</td><td><strong style="color:#0d9488">Live</strong></td></tr>
    <tr><td>Mobile App</td><td>React Native / Expo (APK)</td><td><strong style="color:#0d9488">Available</strong></td></tr>
    <tr><td>Languages</td><td>English, Amharic, Oromo</td><td><strong style="color:#0d9488">Shipped</strong></td></tr>
    <tr><td>ML Pipeline</td><td>Synthetic data &rarr; Train &rarr; Evaluate &rarr; Promote &rarr; Auto-retrain</td><td><strong style="color:#0d9488">Operational</strong></td></tr>
    <tr><td>Event Detection</td><td>Hard braking, rapid acceleration, sharp turns, unstable motion, plus more</td><td><strong style="color:#0d9488">Active</strong></td></tr>
  </table>

  <h3>What Users Say</h3>
  <div class="two-col">
    <div class="callout">
      <p><em>"I like seeing the trip score and plain reasons after each drive. It feels clear, not confusing, and it actually helps me notice my braking habits."</em></p>
      <p style="margin-top:4px;font-size:11px;color:{dim}">&mdash; Sofonias B., regular driver</p>
    </div>
    <div class="callout sky">
      <p><em>"The review side gives us one clean place to inspect flagged trips, confidence, and generated events. It's exactly what we needed."</em></p>
      <p style="margin-top:4px;font-size:11px;color:{dim}">&mdash; Meron T., pilot fleet reviewer</p>
    </div>
  </div>

  <div class="callout" style="margin-top:6px;">
    <p><em>"What stands out is the combination of live trip capture and readable AI feedback. Even in the pilot, the product feels purposeful."</em></p>
    <p style="margin-top:4px;font-size:11px;color:{dim}">&mdash; Abel H., early product partner</p>
  </div>

  <div class="divider"></div>
  <div class="footer">Drive Pulse &middot; Proof of Concept &middot; July 2026</div>
</div>

<!-- ═══════════ 7. THE TECHNOLOGY ═══════════ -->
<div class="page">
  <h2>The Technology (Brief)</h2>
  <p>
    Drive Pulse is built on a modern, scalable technology stack. Every component was chosen for reliability, accessibility, and the ability to operate in infrastructure-constrained environments.
  </p>

  <div class="stat-row">
    <div class="stat-card"><span class="num" style="font-size:14px">Mobile App</span><span class="label">React Native / Expo</span></div>
    <div class="stat-card accent-sky"><span class="num" style="font-size:14px">Backend</span><span class="label">FastAPI on Render</span></div>
    <div class="stat-card accent-lime"><span class="num" style="font-size:14px">Database</span><span class="label">PostgreSQL / Supabase</span></div>
    <div class="stat-card accent-peach"><span class="num" style="font-size:14px">ML Pipeline</span><span class="label">sklearn + ONNX</span></div>
  </div>

  <h3>Mobile Application</h3>
  <p>
    Built with <strong>React Native and Expo</strong>, the app captures GPS, accelerometer, and gyroscope data in real time. It features a demo fallback mode for environments with limited sensor availability, making it useful for onboarding and presentations. The APK is distributed directly from the project website at <strong>drivepulse.onrender.com</strong>.
  </p>

  <h3>Backend &amp; API</h3>
  <p>
    A <strong>FastAPI</strong> application running on Render handles sensor data ingestion, trip management, scoring, and user accounts. The API is designed for efficient batch uploads from mobile devices, with status-aware handling that works even on unreliable mobile networks.
  </p>

  <h3>Machine Learning Pipeline</h3>
  <p>
    The ML pipeline, built with <strong>scikit-learn with ONNX support</strong>, covers the full lifecycle: synthetic data generation, model training, evaluation, promotion to production, and automatic retraining. Importantly, the system also includes <strong>deterministic rule-based scoring</strong> that produces a safety score even when no trained model is available. The two approaches are blended into a single 0&ndash;100 score with confidence bands.
  </p>

  <h3>Database</h3>
  <p>
    <strong>PostgreSQL</strong> hosted by Supabase stores all trip data, sensor samples, user accounts, and driving events. The schema supports role-based access with separate driver and admin capabilities.
  </p>

  <h3>Driving Events Detected</h3>
  <p>
    The system detects six types of driving events: <strong>hard braking, rapid acceleration, sharp turns (left and right), unstable motion, and speed threshold violations</strong>. Each event is timestamped and recorded with context data, allowing reviewers to inspect the exact moment and location of each event on a map.
  </p>

  <div class="divider"></div>
  <div class="footer">Drive Pulse &middot; The Technology &middot; July 2026</div>
</div>

<!-- ═══════════ 8. FUTURE VISION ═══════════ -->
<div class="page">
  <h2>Future Vision</h2>

  <p>
    Drive Pulse has a clear and ambitious roadmap. The foundation is built. Now we scale.
  </p>

  <div class="stat-row">
    <div class="stat-card accent-sky"><span class="num" style="font-size:15px">iOS App</span><span class="label">Q3 2026</span></div>
    <div class="stat-card"><span class="num" style="font-size:15px">Real-time Alerts</span><span class="label">Q4 2026</span></div>
    <div class="stat-card accent-lime"><span class="num" style="font-size:15px">Insurance</span><span class="label">Q1 2027</span></div>
    <div class="stat-card accent-peach"><span class="num" style="font-size:15px">Regional</span><span class="label">Q2 2027</span></div>
  </div>

  <h3>iOS Release (Q3 2026)</h3>
  <p>
    We are building the iOS version of the app to reach the significant and growing number of iPhone users in Ethiopia and across Africa. The iOS version will ship with the same feature set and multilingual support.
  </p>

  <h3>Real-Time In-Trip Alerts (Q4 2026)</h3>
  <p>
    Currently, feedback is delivered post-trip. We are developing real-time audio and haptic alerts that notify drivers immediately when risky behaviour is detected &mdash; a hard brake, a sharp turn, or phone handling &mdash; allowing them to correct in the moment.
  </p>

  <h3>Insurance Partnerships (Q1 2027)</h3>
  <p>
    We are actively exploring partnerships with Ethiopian insurers to create <strong>usage-based insurance models</strong>. Safe drivers would earn premium discounts based on their Drive Pulse scores. This creates a financial incentive for safer driving and gives insurers a data-driven risk assessment tool.
  </p>

  <h3>Regional Expansion (Q2 2027)</h3>
  <p>
    We plan to expand across East Africa, starting with Kenya and Uganda, where similar road safety challenges exist. The product's multilingual architecture makes it adaptable to new language markets with minimal engineering effort.
  </p>

  <h3>Long-Term Vision</h3>
  <p>
    Our ultimate goal: <strong>every smartphone becomes a driving safety coach</strong>, regardless of its owner's income, country, or language. We envision Drive Pulse integrated with public transportation systems, school bus fleets, ride-hailing platforms, and eventually, as a pre-installed feature on smartphones sold in emerging markets. The technology exists. The need is urgent. The time is now.
  </p>

  <div class="divider"></div>
  <div class="footer">Drive Pulse &middot; Future Vision &middot; July 2026</div>
</div>

<!-- ═══════════ 9. CONCLUSION ═══════════ -->
<div class="page">
  <h2>Conclusion</h2>

  <p>
    The road safety crisis in Ethiopia and across the developing world is not a problem of infrastructure alone. It is a crisis of <strong>behaviour, awareness, and access to technology</strong>. The solutions that exist are too expensive, too intrusive, and too disconnected from the realities of low-income markets.
  </p>

  <p>
    Drive Pulse was built to fill that gap. It is a <strong>production-ready, deployed, and tested system</strong> that turns the smartphone in every pocket into a tool for safer driving. It works without expensive hardware, without monthly subscriptions, and without requiring drivers to speak English to understand their feedback. It gives individual drivers actionable insights and gives fleet operators the visibility they need to protect their teams.
  </p>

  <div class="callout">
    <p><strong>50+ trips captured. 144,000+ sensor samples. 6 event types detected. 3 languages supported. Live infrastructure. Real users. Real results.</strong></p>
  </div>

  <p>
    We are not asking judges to imagine what could be possible. We are showing what is already real. The road ahead is long, but the direction is clear: safer roads, smarter drivers, and technology that serves the people who need it most.
  </p>

  <div class="divider"></div>

  <div class="final-note">
    <p><strong>Drive Pulse</strong> &mdash; Driver Intelligence.<br>Built for the roads that need it most.</p>
    <p style="margin-top: 14px; font-size: 12px; color: #4b5563; font-style: normal;">
      Team VisionZero &middot; Abune Gorgorios Schools Kality<br>
      Kidus Sofonias<br>
      <span style="color: #6b7280;">drivepulse.onrender.com &middot; sofoniaskidus@gmail.com &middot; +251 911 422 570</span>
    </p>
  </div>

  <div class="footer">Team VisionZero &middot; Abune Gorgorios Schools Kality &middot; July 2026</div>
</div>

</body>
</html>
"""


def main() -> None:
    print("[1/4] Generating charts...")
    chart_fatalities_b64 = chart_fatalities()
    chart_phone_b64       = chart_phone_risk()
    chart_project_b64     = chart_project_stats()
    chart_causes_b64      = chart_crash_causes()
    chart_gdp_b64         = chart_gdp_impact()

    print("[2/4] Rendering HTML...")
    html = HTML_TEMPLATE.format(
        bg=WHITE,
        card=CARD_BG,
        border=BORDER,
        border_light=BORDER_LIGHT,
        text=TEXT,
        muted=TEXT_MUTED,
        dim=TEXT_DIM,
        teal=ACCENT_TEAL,
        sky=ACCENT_SKY,
        lime=ACCENT_LIME,
        peach=ACCENT_PEACH,
        chart_fatalities=chart_fatalities_b64,
        chart_phone=chart_phone_b64,
        chart_project=chart_project_b64,
        chart_causes=chart_causes_b64,
        chart_gdp=chart_gdp_b64,
    )

    print("[3/4] Converting to PDF via Playwright...")
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("ERROR: playwright not installed. Run: pip install playwright && python -m playwright install chromium")
        return

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1240, "height": 1754})
            page.set_content(html, wait_until="networkidle")
            page.pdf(
                path=str(OUTPUT_PATH),
                format="A4",
                margin={"top": "0mm", "right": "0mm", "bottom": "0mm", "left": "0mm"},
                print_background=True,
            )
            browser.close()
    except Exception as exc:
        print(f"ERROR: PDF generation failed: {exc}")
        print("Try running: python -m playwright install chromium")
        return

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"[4/4] Done! PDF generated: {OUTPUT_PATH}")
    print(f"       Size: {size_kb:.0f} KB")


if __name__ == "__main__":
    main()
