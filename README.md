<div align="center">

# Nexus AI

### AI-Powered Developer Assistant for Automated Code Reviews, Risk Analysis & Developer Analytics

<p align="center">
Automate code reviews, measure pull request risk, evaluate code health, and gain actionable repository insights—all from one intelligent platform.
</p>

<p align="center">

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=for-the-badge&logo=openai&logoColor=white)


</p>

---

###  Live Demo

>(https://nexus-ai-eight-rouge.vercel.app/)





</div>

---

#  Preview

## Mission Control Dashboard

><img width="1895" height="909" alt="image" src="https://github.com/user-attachments/assets/65ea93df-f02e-4870-9253-2fce900e4198" />


---

## AI Review Report

> <img width="1919" height="909" alt="image" src="https://github.com/user-attachments/assets/d9ee37be-1b76-4a67-a16d-61ccf8cd555a" />


---

## Analytics Dashboard

> <img width="1879" height="891" alt="image" src="https://github.com/user-attachments/assets/b3db9698-6dee-44cb-9e15-4939e15c9e6e" />


---

## Repository Explorer

> <img width="1919" height="885" alt="image" src="https://github.com/user-attachments/assets/f48a649c-6527-441f-8fcc-a30642d596f5" />

---

#  About Nexus AI

Nexus AI is a production-grade AI-powered developer platform designed to help engineering teams review code faster, identify potential issues before deployment, and improve overall software quality.

Instead of manually reviewing every pull request, Nexus AI automatically analyzes repositories using AI and provides intelligent recommendations covering:

-  Bugs
-  Security vulnerabilities
-  Performance improvements
-  Refactoring opportunities
-  Repository analytics
-  Developer productivity
-  Pull Request Risk Analysis

Inspired by modern engineering platforms such as:

- GitHub Copilot
- SonarQube
- Datadog
- Sentry
- GitHub Code Review
- Vercel

---

#  Features

##  AI Code Reviews

Analyze GitHub repositories and pull requests using AI.

Automatically detect:

- Logic bugs
- Code smells
- Security issues
- Performance bottlenecks
- Refactoring opportunities
- Maintainability issues

---

##  AI Code Health Score

Every repository review generates an **Overall Code Health Score (0–100)**.

The AI evaluates:

-  Bugs
-  Security
-  Performance
-  Maintainability
-  Code Quality

Higher score = healthier codebase.

---

##  Pull Request Risk Score

Unlike the Code Health Score, the Risk Score is **formula-based**.

It measures the size and disruption of a pull request.

### Factors

- Files Changed
- Total Lines Modified
- Additions vs Deletions
- Average Changes Per File

### Risk Levels

| Score | Level |
|--------|-------|
| <40 | 🟢 Low |
| 40–69 | 🟡 Medium |
| ≥70 | 🔴 High |

---

##  Developer Analytics

Track engineering productivity with interactive dashboards.

Metrics include:

- Connected Repositories
- Open Pull Requests
- AI Reviews
- Code Health
- Risk Scores
- Bugs Detected
- Security Issues
- Performance Suggestions
- Refactoring Suggestions
- Hours Saved

---

##  AI Review Reports

Every review contains:

- Executive Summary
- Overall Score
- Complexity Analysis
- Risk Assessment
- Bugs
- Security Findings
- Performance Suggestions
- Refactoring Recommendations
- Recommended Fixes

Reports can be exported as:

- Markdown
- JSON

---

##  AI Code Explanation

Ask Nexus AI to explain any source file or function in simple language.

Perfect for:

- Learning unfamiliar repositories
- Onboarding developers
- Understanding legacy code

---

##  GitHub Integration

- GitHub OAuth
- Repository Synchronization
- Pull Request Analysis
- Repository Metadata
- Commit History

---

#  Architecture

```
                       GitHub
                          │
          OAuth + REST API + Webhooks
                          │
                          ▼
                  Express API Server
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
     PostgreSQL Database           OpenAI GPT
          │                               │
          └───────────────┬───────────────┘
                          ▼
                  React Dashboard
```

---

#  Workflow

```
Developer Creates PR

        │

        ▼

GitHub Webhook Trigger

        │

        ▼

Backend Fetches PR

        │

        ▼

AI Analyzes Code

        │

        ▼

Generate

• Code Health
• Risk Score
• Bugs
• Security
• Performance
• Refactoring

        │

        ▼

Results Stored

        │

        ▼

Dashboard Updated
```

---

# 🛠 Tech Stack

## Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- React Query

---

## Backend

- Node.js
- Express.js
- TypeScript

---

## Database

- PostgreSQL
- Drizzle ORM

---

## AI

- OpenAI GPT Models

---

## Authentication

- GitHub OAuth

---

## API

- REST API
- OpenAPI
- Orval
- Zod

---


#  Monorepo Structure

```text
Nexus-AI/
│
├── artifacts/
│   ├── ai-dev-assistant/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── utils/
│   │   └── package.json
│   │
│   ├── api-server/
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   ├── services/
│   │   │   ├── controllers/
│   │   │   └── lib/
│   │   └── package.json
│   │
│   └── mockup-sandbox/
│
├── lib/
│   ├── api-client-react/
│   ├── api-spec/
│   ├── api-zod/
│   ├── db/
│   ├── integrations/
│   ├── integrations-openai-ai-react/
│   └── integrations-openai-ai-server/
│
├── scripts/
│
├── .env
├── .gitignore
├── package.json
└── tsconfig.base.json
```

---

#  Workspace Packages

| Package | Description |
|----------|-------------|
| ai-dev-assistant | Frontend dashboard |
| api-server | Backend API |
| mockup-sandbox | Development environment |
| api-client-react | Generated React Query client |
| api-spec | OpenAPI specification |
| api-zod | Validation schemas |
| db | PostgreSQL schema |
| integrations-openai-ai-server | OpenAI backend integration |
| integrations-openai-ai-react | OpenAI frontend components |

---

#  Getting Started

## Clone Repository

```bash
git clone https://github.com/Agnimn/Nexus-AI.git
```

```bash
cd Nexus-AI
```

---

## Install Dependencies

```bash
npm install
```

---

## Configure Environment Variables

Create a `.env`

```env
DATABASE_URL=

OPENAI_API_KEY=

GITHUB_CLIENT_ID=

GITHUB_CLIENT_SECRET=

JWT_SECRET=
```

---

## Run Development Server

```bash
npm run dev
```

---

#  Dashboard Modules

-  Mission Control
-  Repository Explorer
-  AI Reviews
-  Analytics
-  Code Explain

---

# 🛣 Roadmap

- [x] GitHub OAuth
- [x] Repository Integration
- [x] AI Code Reviews
- [x] Code Health Score
- [x] Risk Score
- [x] Analytics Dashboard
- [x] Export Reports
- [ ] GitHub Webhooks
- [ ] Automatic PR Comments
- [ ] Redis Queue
- [ ] Background Workers
- [ ] Organization Support
- [ ] Team Collaboration
- [ ] AI Chat Assistant
- [ ] Kubernetes Deployment

---

#  Contributing

Contributions are welcome!

```bash
git checkout -b feature/my-feature
git commit -m "Add feature"
git push origin feature/my-feature
```

Then open a Pull Request.

---

#  License

Licensed under the MIT License.

---

#  Author

## Agni M N

Software Engineering • Full Stack Developer

- GitHub: https://github.com/Agnimn


