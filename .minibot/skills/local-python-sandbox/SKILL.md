---
name: local-python-sandbox
description: Run Python code locally within an isolated workspace sandbox using uv. Automatically installs dependencies in an ephemeral environment, executes scripts, and generates data tables, charts, or files.
triggers: ["python", "uv", "計算", "分析", "統計", "畫圖", "圖表", "matplotlib", "pandas", "numpy", "excel", "csv", "sandbox", "腳本"]
---

# Local Python & UV Sandbox Execution Guide

MiniBot has access to an isolated, high-performance local Python runtime powered by **`uv`**.

## When to Use
Use `run_python_code` whenever the user asks to:
1. Perform complex mathematical or numerical computations.
2. Parse, transform, or filter datasets (CSV, JSON, TSV).
3. Generate visual graphs and plots (PNG charts, scatter plots, bar charts via `matplotlib` / `seaborn`).
4. Build custom Excel spreadsheets (`openpyxl`, `pandas`).
5. Run custom automation or verification algorithms.

## Execution Rules & Guidelines

1. **Tool Invocation**:
   Always call `run_python_code`:
   ```json
   {
     "code": "# Python script here...",
     "dependencies": ["pandas", "matplotlib", "numpy"],
     "fileName": "data_analysis.py"
   }
   ```

2. **Ephemeral Package Management with `uv`**:
   - Explicitly list required PyPI packages in the `dependencies` array (e.g. `["matplotlib", "pandas", "requests"]`).
   - `uv` automatically pulls and installs them in an isolated ephemeral cache without modifying system Python or requiring manual pip installs.

3. **Workspace Files & Artifacts**:
   - All executions run with the working directory set to `./workspace/`.
   - To save a chart, use:
     ```python
     import matplotlib.pyplot as plt
     # ... plotting logic ...
     plt.tight_layout()
     plt.savefig("sales_chart.png", dpi=300)
     plt.close()
     ```
   - Generated files in `./workspace/` are immediately listed in the tool's execution summary.

4. **Reporting Output to User**:
   - Clearly present script outputs (tables, metrics, summaries).
   - If an image or file was created (e.g. `workspace/sales_chart.png`), inform the user of the generated filename.
