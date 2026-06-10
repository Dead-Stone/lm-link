# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes       |

## Reporting a vulnerability

If you discover a security issue in LM Link for Android, please report it privately:

**Email:** [mohanmoganti2023@gmail.com](mailto:mohanmoganti2023@gmail.com)

Please include:

- A description of the issue
- Steps to reproduce
- Android version and app version (`Settings → About`)
- Whether the issue affects remote LM Studio connections, on-device models, or local storage

Please **do not** open a public GitHub issue for undisclosed security vulnerabilities.

We aim to acknowledge reports within a few business days.

## Scope

In scope:

- LM Link app code in this repository
- Insecure handling of credentials, chat data, or local model files
- Network or permission issues that expose user data without consent

Out of scope:

- Vulnerabilities in LM Studio itself (report to LM Studio / Element Labs)
- Misconfiguration of your LM Studio server (e.g. exposing an unauthenticated server to the public internet)
- Third-party model files or Hugging Face infrastructure

## Safe use

- Use LM Studio on a trusted local network; require API tokens when exposing a server beyond your LAN.
- Do not paste secrets into chat messages.
- Keep LM Studio and LM Link updated.
