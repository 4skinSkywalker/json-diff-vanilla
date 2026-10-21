## Windows environment

- This project is run on Windows using PowerShell.
- `uv` is installed, but the agent's execution environment may not resolve it through PATH.
- When running `uv` commands, use this absolute executable path:
  `C:\Users\[fill username here]\.local\bin\uv.exe`
- In PowerShell, invoke the quoted executable path with the `&` operator.
- For example:
  & "C:\Users\[fill username here]\.local\bin\uv.exe" run --no-cache ...
- Apply this to BMAD workflow commands too. Do not conclude that uv is
  missing merely because the bare `uv` command is not recognized.