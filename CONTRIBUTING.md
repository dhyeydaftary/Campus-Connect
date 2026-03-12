# Contributing to Campus Connect

First off, thank you for considering contributing to Campus Connect! It's people like you that make Campus Connect such a great tool for university communities.

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, please include as many details as possible:
* A clear and descriptive title
* Exact steps to reproduce the problem
* Expected behavior vs actual behavior
* Your operating system, browser, and environment details

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please provide:
* A clear and descriptive title
* A detailed description of the proposed feature
* The specific problem this feature solves

### Pull Requests

1. Fork the repo and create your branch from `main`.
2. Ensure you have installed the development dependencies: `pip install -r requirements-dev.txt`
3. If you've added code that should be tested, add tests.
4. Run the full test suite locally: `pytest`
5. Ensure the test suite passes before submitting your PR.
6. Issue that pull request!

## Setting Up the Development Environment

1. Clone your fork: `git clone https://github.com/YOUR_USERNAME/Campus-Connect.git`
2. Set up the virtual environment: `python -m venv venv && source venv/bin/activate` 
3. Install dependencies: `pip install -r requirements.txt -r requirements-dev.txt`
4. Set up your `.env` file from `.env.example`
5. Initialize the database: `flask db upgrade && flask seed-admin`
6. Run the local server: `python run.py`
