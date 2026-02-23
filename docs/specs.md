# DataTasks — Product Specification

A unified task management application that combines the best aspects of Trello and todo lists, specifically designed for the needs of community managers and small teams.

## Architecture

- **Backend**: AWS Lambda with JavaScript
- **Database**: DynamoDB
- **Frontend**: Single Page Application (SPA) with vanilla JavaScript (no React), served from the Lambda on the index request
- **Deployment**: Fully serverless — Lambda + DynamoDB, no hosting costs

## Local Development

- Use a local DynamoDB alternative that works like SQLite — no need for real DynamoDB locally
- No Docker required for development
- Run and test everything locally without hassle
- Local environment should be as close to Lambda as possible

## Deployment

- Deploy through Lambda and DynamoDB
- If Docker is needed for packaging the deployment, that is acceptable
- Fewer dependencies the better
- If everything fits in one Lambda — perfect
- Simple zip archive deployment would be ideal

## Testing

- Local testing should be easy and straightforward
- Integration testing: run Lambda in Docker and test through that

## The Problem

The current workflow for Grace (community manager at DataTalks Club) involves multiple disjointed systems:

**Multiple task sources:**
- Google Spreadsheet for todo list
- Trello for project cards
- Individual tasks inside Trello cards
- Ad hoc tasks sent via Telegram
- Email forwarding creates additional tasks
- Regular recurring tasks (weekly mailchimp dumps, etc.)

**Inefficiency:** to see what needs to be done today, Grace must:
1. Check the Google Spreadsheet
2. Go through each Trello card
3. Look at tasks inside each card
4. Check for any Telegram messages
5. Check email-derived tasks

This scattered approach means significant time spent just gathering information before any work can begin.

## Why Existing Tools Don't Work

**Trello limitations:**
- Ad hoc tasks cannot be easily added to Trello
- Would need to create a separate card for each small task (overkill)
- Tasks are trapped inside cards — no unified view of all tasks across cards
- No way to see all today's tasks at a glance without opening every card
- Integrations exist (Zapier, n8n, etc.) but may be paid and limited

**Other tools:**
- Monday, Asana, Jira — don't quite fit this specific use case
- Trello's power-ups and integrations are limited to what they support
- Need something simple and customizable

## The Vision

A unified task management system that combines:
- Trello-like project templates and cards
- Spreadsheet-like task list view
- Automated task capture from multiple sources
- Template-based deadline management

### Core Concepts

**Templates (Playbooks):**
- Newsletter template
- Course template
- Event template
- Each template contains a set of related tasks with relative deadlines

**Anchor Date:** each card/project has an anchor date (e.g., event date, launch date)
- Tasks have relative deadlines: "2 weeks before", "1 week before", "1 week after"
- System automatically calculates actual due dates based on anchor date
- All tasks from the project appear in the unified task list

**Two views:**
1. **Project/Card View** — like Trello, high-level organization
2. **Task List View** — all tasks from all projects in a simple table

### Task Types

**Template-based tasks:**
- Created automatically when a project is instantiated from a template
- Have relative deadlines calculated from anchor date
- Appear in both the project card and the unified task list

**Ad hoc tasks:**
- Created via Telegram slash command
- Created via email forwarding
- Standalone tasks not part of any project
- Appear in the unified task list

**Recurring tasks:**
- Regular tasks like "weekly mailchimp dump" on Wednesdays
- Automatically added to the task list on schedule
- Configurable schedule

### Simple Task Interface

Each task should have:
- Date
- Task description
- Comment field (for links to results, like process documents)
- Status (todo/done)

When Grace completes a task (like converting a Loom video to a process document), she adds the link in the comment field and marks it done.

## Value Beyond Internal Use

This tool could be useful for others:
- Shows how DataTalks Club organizes work
- Could be shared with the community
- Might be interesting to other small teams with similar workflows

## Potential Extensions

**Invoice tracking:**
- Invoice tracking functionality
- Reminders for pending invoices
- Could be separate or integrated into the task system
