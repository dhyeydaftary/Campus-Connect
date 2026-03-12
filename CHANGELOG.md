# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Created `runtime.txt` to explicitly specify Python 3.11 for deployment platforms.
- Split development dependencies into `requirements-dev.txt` for leaner production builds.
- Added GitHub community files (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`).

## [1.0.0] - Initial Release
### Added
- Initial setup of Campus Connect platform.
- Full authentication system with OTP and password handling.
- Real-time chat system via WebSockets (Flask-SocketIO).
- User profiles, skill tagging, and experience tracking.
- Social feed with rich attachments.
- Event management system with seat tracking.
- Admin dashboard with oversight features.
- PostgreSQL database schema and migration setup.
