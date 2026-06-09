import streamlit as st
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path

st.set_page_config(
    page_title="Agents Intelligence",
    layout="wide",
    initial_sidebar_state = 'collapsed'
)

PROJECT_ROOT = Path.cwd().parent
DATA_PROJECT = PROJECT_ROOT / "models" / "kmeans" / "results" / "labeled_frame.csv"

data = pd.read_csv(DATA_PROJECT)

label_map = {
    0: "Light Users",
    1: "Light Medium Users",
    2: "Crawler Agents",
    3: "Burst User Agents"
}

label_risk = {
    0: "LOW",
    1: "MEDIUM",
    2: "HIGH",
    3: "HIGH"
}

data["label_name"] = data["labels"].map(label_map)
data["risk"] = data["labels"].map(label_risk)

st.title("Agents Intelligence")
st.caption("Behavioral clustering over Vercel Log Drains · KMeans · Human-in-the-loop firewall review")

# -------------------------
# Global metrics
# -------------------------

total_requests = int(data["conteo_requests"].sum())
total_agents = len(data)
unique_ips = data["proxy.clientIp"].nunique()
high_risk_agents = data[data["risk"] == "HIGH"].shape[0]

m1, m2, m3, m4 = st.columns(4)

m1.metric("Total requests", f"{total_requests:,}")
m2.metric("Agent groups", f"{total_agents:,}")
m3.metric("Unique IPs", f"{unique_ips:,}")
m4.metric("High risk groups", f"{high_risk_agents:,}")

st.divider()

# -------------------------
# Label summary
# -------------------------
summary = (
    data
    .groupby(["labels", "label_name", "risk"])
    .agg(
        requests_total=("conteo_requests", "sum"),
        agent_groups=("conteo_requests", "count"),
        unique_ips=("proxy.clientIp", "nunique"),
        unique_user_agents=("proxy.userAgent", "nunique"),
        avg_requests=("conteo_requests", "mean"),
        avg_activity_window_ms=("activity_window_ms", "mean"),
        avg_time_between_ms=("median_time_between_requests_ms", "mean")
    )
    .reset_index()
    .sort_values("labels")
)

summary["cluster_display"] = summary.apply(
    lambda row: f"Label {row['labels']} · {row['label_name']}",
    axis=1
)

left, right = st.columns([1.7, 1])

with left:
    activity_placeholder = st.empty()

with right:
    st.subheader("Cluster control")

    label_options = summary["labels"].tolist()
    cluster_options = [None] + label_options

    selected_label = st.selectbox(
        "Select cluster",
        cluster_options,
        format_func=lambda x: (
            "All groups · request overview"
            if x is None
            else f"Label {x} · {label_map.get(x, 'Unknown')}"
        )
    )

    if selected_label is None:
        c1, c2 = st.columns(2)
        c1.metric("Clusters", f"{len(summary):,}")
        c2.metric("Total groups", f"{int(summary['agent_groups'].sum()):,}")

        c3, c4 = st.columns(2)
        c3.metric("Total IPs", f"{int(summary['unique_ips'].sum()):,}")
        c4.metric("High risk", f"{high_risk_agents:,}")

        st.caption("All groups selected · Bubble size shows request group volume.")
    else:
        selected_summary = summary[summary["labels"] == selected_label].iloc[0]

        c1, c2 = st.columns(2)
        c1.metric("Requests", f"{int(selected_summary['requests_total']):,}")
        c2.metric("Groups", f"{int(selected_summary['agent_groups']):,}")

        c3, c4 = st.columns(2)
        c3.metric("IPs", f"{int(selected_summary['unique_ips']):,}")
        c4.metric("User Agents", f"{int(selected_summary['unique_user_agents']):,}")

        avg_seconds = selected_summary["avg_time_between_ms"] / 1000
        activity_minutes = selected_summary["avg_activity_window_ms"] / 60000
        request_share = selected_summary["requests_total"] / total_requests

        st.progress(float(request_share), text=f"Traffic share · {request_share:.1%}")
        st.caption(
            f"Median between requests: **{avg_seconds:.2f}s** · "
            f"Avg activity window: **{activity_minutes:.2f}m**"
        )

with activity_placeholder.container():
    st.subheader("Request group bubble map")

    plot_data = summary.copy()
    plot_data["bubble_size"] = (
        (plot_data["agent_groups"] / plot_data["agent_groups"].max()) * 1800
    ) + 260
    plot_data["point_color"] = plot_data["risk"].map(
        {"LOW": "#3BA273", "MEDIUM": "#D4A017", "HIGH": "#D64545"}
    )
    plot_data["point_alpha"] = plot_data["labels"].apply(
        lambda label: 0.82 if selected_label is None or label == selected_label else 0.18
    )
    plot_data["edge_color"] = plot_data["labels"].apply(
        lambda label: "#111827" if selected_label is None or label == selected_label else "#D1D5DB"
    )

    fig, ax = plt.subplots(figsize=(8.6, 4.4))

    for _, row in plot_data.iterrows():
        is_selected = selected_label is None or row["labels"] == selected_label
        ax.scatter(
            row["requests_total"],
            row["avg_requests"],
            s=row["bubble_size"],
            c=row["point_color"],
            alpha=row["point_alpha"],
            linewidth=2.3 if is_selected else 1,
            edgecolors=row["edge_color"]
        )

        ax.annotate(
            f"L{int(row['labels'])}",
            (row["requests_total"], row["avg_requests"]),
            ha="center",
            va="center",
            fontsize=10,
            color="#111827" if is_selected else "#9CA3AF",
            weight="bold" if is_selected else "normal"
        )

    selected_title = (
        "All request groups"
        if selected_label is None
        else f"Label {selected_label} · {label_map.get(selected_label, 'Unknown')}"
    )

    ax.set_xlabel("Total requests")
    ax.set_ylabel("Avg requests per group")
    ax.set_title(
        selected_title,
        loc="left",
        fontsize=12,
        weight="bold"
    )
    ax.grid(True, linestyle="--", linewidth=0.7, alpha=0.26)
    ax.spines[["top", "right"]].set_visible(False)
    ax.margins(x=0.18, y=0.24)
    fig.tight_layout()

    st.pyplot(fig, use_container_width=True)
    plt.close(fig)

    legend_cols = st.columns(len(plot_data))
    for legend_col, (_, row) in zip(legend_cols, plot_data.iterrows()):
        with legend_col:
            st.caption(
                f"**L{int(row['labels'])}** · "
                f"{int(row['agent_groups']):,} groups · "
                f"{int(row['requests_total']):,} req"
            )

st.divider()

selected_data = (
    data.copy()
    if selected_label is None
    else data[data["labels"] == selected_label].copy()
)
