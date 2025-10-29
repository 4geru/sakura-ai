# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-component repository that includes:
1. **Mastra-based AI Agent Framework** (`mastra/`) - A weather agent system using the Mastra framework
2. **Sakura AI Integration Scripts** (root level) - MCP server and RAG utilities for Sakura AI API

## Development Commands

### Mastra Weather Agent (mastra/)
- **Development**: `cd mastra && npm run dev` - Start Mastra development server
- **Build**: `cd mastra && npm run build` - Build the Mastra application
- **Start**: `cd mastra && npm run start` - Start the built application
- **Package Manager**: Uses npm with Node.js >=20.9.0

### Sakura AI Scripts (root level)
- **MCP Server**: `node mcp.mjs` - Start the Sakura Documents Query MCP server
- **RAG Search**: `node search.mjs "query" --tags=tag1,tag2 --model=gpt-oss-120b` - Perform RAG queries
- **Document Upload**: `node upload.mjs` - Upload documents to Sakura AI vector store
- **Package Manager**: Uses pnpm

## Environment Setup

All Sakura AI scripts require:
```bash
SAKURA_AI_TOKEN=your_bearer_token
```

Create a `.env` file in the root directory with this token for upload and search scripts.

## Architecture

### Mastra Weather Agent (`mastra/src/mastra/`)
- **Main Configuration** (`index.ts`): Configures Mastra instance with workflows, agents, scorers, LibSQL storage, and observability
- **Agent** (`agents/weather-agent.ts`): Google Gemini-powered weather assistant with memory and scoring
- **Tool** (`tools/weather-tool.ts`): Weather data fetching via Open-Meteo API with geocoding
- **Workflow** (`workflows/weather-workflow.ts`): Orchestrates weather-related tasks
- **Scorers** (`scorers/weather-scorer.ts`): Evaluates tool appropriateness, completeness, and translation quality

### Sakura AI Integration (root level)
- **MCP Server** (`mcp.mjs`): Model Context Protocol server for document querying
- **RAG Search** (`search.mjs`): Retrieval-Augmented Generation implementation with vector search
- **File Upload** (`upload.mjs`): Document upload utility for vector store

## Key Dependencies

### Mastra Project
- `@mastra/core`: Core Mastra framework
- `@mastra/memory`, `@mastra/libsql`: Memory and storage systems
- `@mastra/loggers`, `@mastra/evals`: Logging and evaluation tools
- `zod`: Schema validation

### Sakura AI Scripts
- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `node-fetch`, `form-data`: HTTP client and file uploads
- `dotenv`: Environment variable management

## API Configuration

- **Sakura AI Base URL**: `https://api.ai.sakura.ad.jp/v1`
- **Default Model**: `gpt-oss-120b`
- **Vector Store Endpoints**: `/documents/query/`, `/documents/upload/`, `/chat/completions`