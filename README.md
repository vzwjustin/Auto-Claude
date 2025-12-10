# Auto-Build Framework

A production-ready framework for autonomous multi-session AI coding. Build complete applications or add features to existing projects through coordinated AI agent sessions.

## What It Does

Auto-Build uses a **multi-agent pattern** to build software autonomously:

1. **Spec Agent** (`claude /spec`) - Interactive spec creation with strategic analysis (ultra-think)
2. **Planner Agent** (Session 1) - Analyzes spec, creates chunk-based implementation plan
3. **Coder Agent** (Sessions 2+) - Implements chunks one-by-one with verification
4. **QA Reviewer Agent** - Validates all acceptance criteria before sign-off
5. **QA Fixer Agent** - Fixes issues found by QA in a self-validating loop

Each session runs with a fresh context window. Progress is tracked via `implementation_plan.json` and Git commits.

## Quick Start

### Prerequisites

- Python 3.8+
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)

### Setup

**Step 1:** Copy files into your project

Copy these two things from this repository into your project:

1. The `auto-build` folder → copy to your project root
2. The `.claude/commands/spec.md` file → copy to `.claude/commands/` in your project (create the folder if it doesn't exist)

**Step 2:** Copy `.env.example` to `.env`

```bash
cp auto-build/.env.example auto-build/.env
```

**Step 3:** Get your OAuth token and add it to `.env`

```bash
# Run this command to get your token
claude setup-token

# Copy the token and paste it into auto-build/.env
# Replace 'your-oauth-token-here' with your actual token
```

**Step 4:** Create a spec interactively (also sets up Python environment)

You have two options:

**Option 1:** Using Claude Code CLI in terminal

```bash
# Start Claude Code
claude

# Then write:
/spec "whatever you want to create"
```

**Option 2:** Using your favorite IDE (like Cursor)

Open your IDE's AI agent chat and write:

```
/spec "whatever you want to create"
```

The spec agent will guide you through creating a detailed specification and set up the Python environment automatically.

**Step 5:** Activate the virtual environment and run

```bash
# Activate the virtual environment
source auto-build/.venv/bin/activate

# Run the autonomous build
python auto-build/run.py --spec 001
```

### Managing Specs

```bash
# List all specs and their status
python auto-build/run.py --list

# Run a specific spec
python auto-build/run.py --spec 001
python auto-build/run.py --spec 001-feature-name

# Run with parallel workers (2-3x speedup for independent phases)
python auto-build/run.py --spec 001 --parallel 2
python auto-build/run.py --spec 001 --parallel 3

# Limit iterations for testing
python auto-build/run.py --spec 001 --max-iterations 5
```

### QA Validation

After all chunks are complete, QA validation runs automatically:

```bash
# QA runs automatically after build completes
# To skip automatic QA:
python auto-build/run.py --spec 001 --skip-qa

# Run QA validation manually on a completed build
python auto-build/run.py --spec 001 --qa

# Check QA status
python auto-build/run.py --spec 001 --qa-status
```

The QA validation loop:
1. **QA Reviewer** checks all acceptance criteria (unit tests, integration tests, E2E, browser verification, database migrations)
2. If issues found → creates `QA_FIX_REQUEST.md`
3. **QA Fixer** applies fixes
4. Loop repeats until approved (up to 50 iterations)
5. Final sign-off recorded in `implementation_plan.json`

### Spec Validation (Self-Correcting)

The `/spec` command now includes mandatory validation checkpoints that catch errors before they propagate:

```bash
# Validate spec outputs manually
python auto-build/validate_spec.py --spec-dir auto-build/specs/001-feature --checkpoint all

# Validate specific checkpoints
python auto-build/validate_spec.py --spec-dir auto-build/specs/001-feature --checkpoint prereqs
python auto-build/validate_spec.py --spec-dir auto-build/specs/001-feature --checkpoint spec
python auto-build/validate_spec.py --spec-dir auto-build/specs/001-feature --checkpoint plan

# Auto-fix common issues
python auto-build/validate_spec.py --spec-dir auto-build/specs/001-feature --checkpoint plan --auto-fix
```

**Validation checkpoints:**
| Checkpoint | What it validates |
|------------|-------------------|
| `prereqs` | project_index.json exists |
| `context` | context.json has required fields |
| `spec` | spec.md has required sections |
| `plan` | implementation_plan.json has valid schema |
| `all` | All of the above |

The spec agent runs these automatically and fixes any failures before proceeding.

### Isolated Worktrees (Safe by Default)

Auto-Build uses Git worktrees to keep your work completely safe. All AI-generated code is built in a separate workspace (`.worktrees/auto-build/`) - your current files are never touched until you explicitly merge.

**How it works:**

1. When you run auto-build, it creates an isolated workspace
2. All coding happens in `.worktrees/auto-build/` on its own branch
3. You can `cd` into the worktree to test the feature before accepting
4. Only when you're satisfied, merge the changes into your project

**After a build completes, you can:**

```bash
# Test the feature in the isolated workspace
cd .worktrees/auto-build/
npm run dev  # or your project's run command

# See what was changed
python auto-build/run.py --spec 001 --review

# Add changes to your project
python auto-build/run.py --spec 001 --merge

# Discard if you don't like it (requires confirmation)
python auto-build/run.py --spec 001 --discard
```

**Key benefits:**

- **Safety**: Your uncommitted work is protected - auto-build won't touch it
- **Testability**: Run and test the feature before committing to it
- **Easy rollback**: Don't like it? Just discard the worktree
- **Parallel-safe**: Multiple workers can build without conflicts

If you have uncommitted changes, auto-build automatically uses isolated mode. With a clean working directory, you can choose between isolated (recommended) or direct mode.

### Interactive Controls

While the agent is running, you can:

```bash
# Pause and optionally add instructions
Ctrl+C (once)
# You'll be prompted to add instructions for the agent
# The agent will read these instructions when you resume

# Exit immediately without prompting
Ctrl+C (twice)
# Press Ctrl+C again during the prompt to exit
```

**Alternative (file-based):**
```bash
# Create PAUSE file to pause after current session
touch auto-build/specs/001-name/PAUSE

# Manually edit instructions file
echo "Focus on fixing the login bug first" > auto-build/specs/001-name/HUMAN_INPUT.md
```

## Project Structure

```
your-project/
├── .claude/commands/
│   └── spec.md              # Interactive spec creation
├── .worktrees/              # Created during build (git-ignored)
│   └── auto-build/          # Isolated workspace for AI coding
├── auto-build/
│   ├── run.py               # Build entry point
│   ├── spec_runner.py       # Spec creation orchestrator
│   ├── validate_spec.py     # Spec validation with JSON schemas
│   ├── agent.py             # Session orchestration
│   ├── planner.py           # Deterministic implementation planner
│   ├── worktree.py          # Git worktree management
│   ├── workspace.py         # Workspace selection UI
│   ├── coordinator.py       # Parallel execution coordinator
│   ├── qa_loop.py           # QA validation loop
│   ├── client.py            # Claude SDK configuration
│   ├── spec_contract.json   # Spec creation contract (required outputs)
│   ├── prompts/
│   │   ├── planner.md       # Session 1 - creates implementation plan
│   │   ├── coder.md         # Sessions 2+ - implements chunks
│   │   ├── spec_gatherer.md # Requirements gathering agent
│   │   ├── spec_writer.md   # Spec document creation agent
│   │   ├── qa_reviewer.md   # QA validation agent
│   │   └── qa_fixer.md      # QA fix agent
│   └── specs/
│       └── 001-feature/     # Each spec in its own folder
│           ├── spec.md
│           ├── requirements.json     # User requirements (structured)
│           ├── implementation_plan.json
│           ├── qa_report.md          # QA validation report
│           └── QA_FIX_REQUEST.md     # Issues to fix (if rejected)
└── [your project files]
```

## Key Features

- **Domain Agnostic**: Works for any software project (web apps, APIs, CLIs, etc.)
- **Multi-Session**: Unlimited sessions, each with fresh context
- **Parallel Execution**: 2-3x speedup with multiple workers on independent phases
- **Isolated Worktrees**: Build in a separate workspace - your current work is never touched
- **Self-Verifying**: Agents test their work with browser automation before marking complete
- **QA Validation Loop**: Automated QA agent validates all acceptance criteria before sign-off
- **Self-Healing**: QA finds issues → Fixer agent resolves → QA re-validates (up to 50 iterations)
- **Strategic Analysis**: Deep thinking phase during spec creation ensures thorough planning
- **Spec Validation**: Mandatory checkpoints with JSON schema validation catch errors before they propagate
- **Fix Bugs Immediately**: Agents fix discovered bugs in the same session, not later
- **Defense-in-Depth Security**: OS sandbox, filesystem restrictions, command allowlist
- **Secret Scanning**: Automatic pre-commit scanning blocks secrets with actionable fix instructions
- **Human Intervention**: Pause, add instructions, or stop at any time
- **Multiple Specs**: Track and run multiple specifications independently

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLAUDE_CODE_OAUTH_TOKEN` | Yes | OAuth token from `claude setup-token` |
| `AUTO_BUILD_MODEL` | No | Model override (default: claude-opus-4-5-20251101) |

## Documentation

For parallel execution details:
- How parallelism works
- Performance analysis
- Best practices
- Troubleshooting

See [auto-build/PARALLEL_EXECUTION.md](auto-build/PARALLEL_EXECUTION.md)

## Acknowledgments

This framework was inspired by Anthropic's [Autonomous Coding Agent](https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding). Thank you to the Anthropic team for their innovative work on autonomous coding systems.

## License

MIT License
