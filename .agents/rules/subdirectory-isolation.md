# Sub-Directory Isolation & Workspace Hygiene Rule

To maintain an organized, clean, and maintainable project environment:

1. **Sub-Directory Isolation Requirement**:
   - Any newly created build document, execution report, or task script **MUST** be placed in its own dedicated sub-directory named after the task or artifact identifier (e.g., creating `2026-10-08_10-35-14.md` requires creating a `2026-10-08_10-35-14/` sub-directory as its working directory).
   - All associated scripts, logs, intermediate files, and documentation must reside inside this dedicated sub-directory.

2. **Prohibition of Root Clutter**:
   - Never write loose build reports, transient test scripts, or timestamped markdown documents directly into the repository root.
