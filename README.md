# CRAM ESSENTIAL - AI-Powered Development Team for VS Code

> **Turn Claude, GPT-4, Gemini, and any AI into a full software development company that builds your projects autonomously.**

CRAM ESSENTIAL orchestrates multiple AI models as a virtual software development company with **12 specialized roles**, **4 orchestration strategies**, and a **full SDLC pipeline** — all inside VS Code.

**One click. Multiple AIs. Complete projects.**

---

## Why CRAM ESSENTIAL?

| Feature | CRAM ESSENTIAL | Single AI Tools |
|---------|---------------|-----------------|
| Multiple AIs working together | Yes | No |
| AI team with specialized roles | 12 roles | None |
| Full project lifecycle (SDLC) | 6 stages | None |
| AI meetings with debates | Yes | No |
| Decision tracking | Yes | No |
| Works with Claude + GPT + Gemini | All at once | One at a time |

---

## Features

### 12 AI Team Members
Your AI company has specialized employees:

| Role | Default AI | Responsibility |
|------|-----------|---------------|
| CEO | Claude | Vision & strategy |
| CTO | Claude | Technology decisions |
| Lead Architect | Claude | System design |
| Senior Developer | GPT-4 | Core implementation |
| Frontend Developer | GPT-4 | UI/UX code |
| Backend Developer | GPT-4 | APIs & databases |
| QA Engineer | Gemini | Testing & bugs |
| Security Auditor | Gemini | Vulnerability analysis |
| DevOps Engineer | Gemini | CI/CD & deployment |
| SEO Specialist | GPT-4 | Search optimization |
| Marketing Strategist | Claude | Go-to-market |
| Performance Engineer | Gemini | Speed optimization |

### 4 Orchestration Strategies

- **Collaborative** — Architect designs, Developer codes, Reviewer critiques, then refine. Best for complex projects.
- **Sequential** — Pipeline chain: each AI builds on the previous output. Best for step-by-step tasks.
- **Parallel** — All AIs work independently, then results are synthesized. Best for speed.
- **Competitive** — AIs compete, a judge scores and picks the best. Best for quality.

### Full SDLC Pipeline

```
Discovery --> Architecture --> Implementation --> QA --> SEO/Marketing --> Deployment
```

Each stage runs an AI meeting where your team:
- Debates approaches and trade-offs
- @mentions each other to ask questions
- Makes tracked decisions with rationale
- Produces code, docs, and reports

### AI Meetings
Real multi-turn conversations between AI team members. They debate algorithms, review each other's code, challenge assumptions, and reach consensus — just like a real development team.

### Custom Providers
Add **any** OpenAI-compatible API: Ollama, Mistral, Together AI, LM Studio, Cohere, and more.

```json
"cramEssential.customProviders": [
  {
    "name": "ollama",
    "baseUrl": "http://localhost:11434/v1",
    "model": "llama3",
    "apiKey": ""
  }
]
```

---

## Quick Start

1. **Install** CRAM ESSENTIAL from the VS Code Marketplace
2. **Click** the CRAM ESSENTIAL icon in the Activity Bar (left sidebar)
3. **Add** at least one API key (Claude, GPT-4, or Gemini)
4. **Run** `CRAM ESSENTIAL: Start Company Project` from the Command Palette

> You only need **one** AI provider to get started. Add more for multi-AI collaboration.

---

## All Commands

| Command | Description |
|---------|------------|
| `CRAM ESSENTIAL: Start Company Project` | Run your project through the full SDLC pipeline |
| `CRAM ESSENTIAL: Start Meeting` | Start an AI team meeting on any topic |
| `CRAM ESSENTIAL: Set Orchestration Strategy` | Switch between Collaborative/Sequential/Parallel/Competitive |
| `CRAM ESSENTIAL: Assign Company Roles` | Reassign which AI plays which role |
| `CRAM ESSENTIAL: View Decision Log` | See all decisions made by your AI team |
| `CRAM ESSENTIAL: Export Session` | Save the full session to disk |
| `CRAM ESSENTIAL: Welcome` | Open the welcome & setup guide |

---

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `cramEssential.claude.apiKey` | Anthropic API key | — |
| `cramEssential.gpt.apiKey` | OpenAI API key | — |
| `cramEssential.gemini.apiKey` | Google AI API key | — |
| `cramEssential.defaultStrategy` | Default orchestration strategy | `collaborative` |
| `cramEssential.meetingMaxTurns` | Max conversation turns per meeting | `8` |
| `cramEssential.maxTokensPerRequest` | Max tokens per AI request | `4096` |
| `cramEssential.timeoutMs` | Timeout per request (ms) | `120000` |
| `cramEssential.logLevel` | Logging level | `info` |

---

## Get Your API Keys

| Provider | Where to get it | Free tier? |
|----------|----------------|-----------|
| **Claude** | [console.anthropic.com](https://console.anthropic.com/) | Yes (limited) |
| **GPT-4** | [platform.openai.com](https://platform.openai.com/api-keys) | No |
| **Gemini** | [aistudio.google.dev](https://aistudio.google.dev/apikey) | Yes |

---

## License

MIT - [Alen Thomas](https://github.com/ALENTH0MAS)
