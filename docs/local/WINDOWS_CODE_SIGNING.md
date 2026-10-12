# Windows code signing (Authenticode)

Electron Builder signs Windows installers when these environment variables are set:

| Variable | Purpose |
|----------|---------|
| `CSC_LINK` | Base64-encoded `.pfx` certificate (or path to the file) |
| `CSC_KEY_PASSWORD` | Password for the PFX |
| `WIN_CSC_SUBJECT` | Optional — subject name when multiple certs match |

## GitHub Actions

Store `CSC_LINK` and `CSC_KEY_PASSWORD` as repository secrets. The `build-win-fat` workflow uses them when present.

## SmartScreen

New certificates need reputation before Windows SmartScreen stops warning users. EV certificates build reputation faster than standard OV certs.

## Unsigned local builds

Omit `CSC_*` variables. CI produces unsigned installers suitable for testing; users may need to click through SmartScreen warnings.
