import streamlit as st

## Interface destinada al consumo de Log Drains desde Vercel y build_kmeans_vercel_drains.py

pg = st.navigation(
    [
        st.Page("page_1.py", title="Agents Intelligence"),
    ]
)
pg.run()
