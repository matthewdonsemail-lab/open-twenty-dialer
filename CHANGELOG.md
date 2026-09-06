# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Self-hosted backend with SQLite database
- Express.js API server with JWT authentication
- Twenty CRM integration for member authentication
- PostgreSQL password hash verification for Twenty credentials
- Tailscale deployment support for node01
- Docker Compose deployment
- GitHub Actions CI workflow
- Comprehensive documentation
- Data seeder with sample leads

### Changed
- Rebranded from "Apex Precision Billing" to "Cold Dialer"
- Rebranded from "Cold Dialer" to "Open Twenty Dialer"
- Replaced Supabase auth with Twenty CRM credential verification
- Removed Supabase dependency entirely
- Updated hooks to use backend API exclusively

### Fixed
- Removed hardcoded email from dev user
- Updated .env.example with all configuration options
- Expanded .gitignore for better security

## [1.0.0] - 2026-01-XX

### Added
- Initial release
- React + Vite + TypeScript frontend
- Self-hosted backend with SQLite
- Twenty CRM integration
- SIP.js softphone with SignalWire support
- Lead management with CSV import
- Campaign management
- Call history and logging
- Dashboard with analytics
- Admin panel
