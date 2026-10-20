import type { FlowFile } from './flow-file'
import type { Agent, Step, Task } from './types'

let stepCounter = 0
export const newStepId = () => `step-${++stepCounter}`

export function makeStep(agent: Agent, patch: Partial<Step> = {}): Step {
  const task = patch.task ?? 'New step'
  return {
    id: newStepId(),
    agent: agent.id,
    task,
    prompt: defaultPrompt(task),
    promptEdited: false,
    tools: agent.tools,
    minutes: 5,
    mode: 'after',
    approval: 'never',
    streak: 0,
    ...patch,
  }
}

export const defaultPrompt = (task: string) =>
  `Your job: ${task || 'this step'}.\n\nUse what the previous step produced. When you are done, write a short note on what you did and anything you were unsure about.`

export const SETUP_PROMPT = (request: string) => `${request}

Set this up as an OpenWove flow: write a flow.json in the flows/ folder, following the openwove-builder skill.
- Split the work into stages; steps in the same stage run at the same time.
- Pick an agent and model for each step, and only the tools it needs.
- Write each step's prompt in plain language.
- Anything that publishes, pays or deletes: ask me first until it has earned it.`

/** The example flow the app opens with. Simulated only: its tools aren't connected. */
export const SAMPLE_FLOW: FlowFile = {
  version: 1,
  name: 'Pricing page refresh',
  request: 'Refresh our pricing page from what competitors charge. Let me OK anything before it goes live.',
  agents: [
    { id: 'researcher', name: 'Researcher', provider: 'anthropic', model: 'claude-opus-5-5', effort: 'medium', tools: ['google', 'notion'] },
    { id: 'writer', name: 'Writer', provider: 'anthropic', model: 'claude-sonnet-5-5', effort: 'medium', tools: ['figma', 'notion'] },
    { id: 'reviewer', name: 'Reviewer', provider: 'openai', model: 'gpt-6-sol', effort: 'medium', tools: ['notion', 'slack'] },
    { id: 'ops', name: 'Ops', provider: 'google', model: 'gemini-3.8-flash', effort: 'low', tools: ['stripe', 'github'] },
  ],
  steps: [
    {
      id: 'competitor-pricing', agent: 'researcher', task: 'Competitor pricing', stage: 0, approval: 'never',
      prompt: 'Find the current prices of the 9 competitors in our Notion list “Competitors”.\n\nFor each plan, write down the plan name, the monthly price, and what is included. Put it all in the Notion table “Competitor pricing”.\n\nFlag anything that changed since last month.',
    },
    {
      id: 'draft-page', agent: 'writer', task: 'Draft pricing page', stage: 1, approval: 'never',
      prompt: 'Using the “Competitor pricing” table, draft our new pricing page: a headline, three plan cards and a short FAQ.\n\nKeep our current prices. Write plainly, no hype. Match the layout of the Figma frame “Pricing / v3”.',
    },
    {
      id: 'customer-quotes', agent: 'researcher', task: 'Customer quotes', stage: 1, approval: 'never', tools: ['notion', 'slack'],
      prompt: 'Read the last 14 customer interview notes in Notion. Pull out short quotes about price and value, and group them by theme so the Writer can use them on the page.',
    },
    {
      id: 'review-publish', agent: 'reviewer', task: 'Review and publish', stage: 2, approval: 'earned',
      asks: 'wants to publish the pricing page',
      prompt: 'Check every price on the draft against the “Competitor pricing” table and our own price list. Fix typos.\n\nWhen it is right, publish the page and post a two-line summary in #launches on Slack.',
    },
  ],
}

/** Made-up progress notes and durations for the sample flow's simulated runs. */
export const SAMPLE_PLAYBACK: Record<string, { minutes: number; log: string[] }> = {
  'competitor-pricing': { minutes: 6, log: ['Searched 9 competitor sites', 'Pulled every plan into a Notion table', 'Flagged 3 price changes this quarter'] },
  'draft-page': { minutes: 8, log: ['Read the competitor table', 'Wrote the headline and 3 plan cards', 'Matched the copy to the Figma frame'] },
  'customer-quotes': { minutes: 7, log: ['Read 14 interview notes', 'Grouping quotes by theme', 'Picked 6 quotes for the page'] },
  'review-publish': { minutes: 5, log: ['Checked prices against the table', 'Fixed 2 typos', 'Ready to publish'] },
}

const historyTask = (t: Omit<Task, 'approval' | 'gatePassed' | 'asked' | 'actedAlone' | 'gateText'> & Partial<Task>): Task => ({
  approval: 'never', gatePassed: false, asked: false, actedAlone: false, gateText: '', ...t,
})

/** Work that happened before the page opened, so the timeline isn't empty. */
export const initialHistory = (): Task[] => [
  historyTask({
    id: 'history-inbox', agent: 'researcher', model: 'claude-opus-5-5', label: 'Inbox digest', tools: ['gmail', 'notion'],
    minutes: 7, worked: 7, start: -27, end: -20, state: 'done', inputTokens: 61_000, outputTokens: 5_200,
    log: ['Read 41 unread emails', 'Summed up 6 that need replies'],
  }),
  historyTask({
    id: 'history-pr', agent: 'reviewer', model: 'gpt-6-sol', label: 'PR #482 billing', tools: ['github', 'linear'],
    minutes: 18, worked: 18, start: -36, end: -18, state: 'done', inputTokens: 140_000, outputTokens: 9_800,
    log: ['Reviewed 12 changed files', 'Left 4 comments', 'Approved after fixes'],
  }),
  historyTask({
    id: 'history-crm', agent: 'ops', model: 'gemini-3.8-flash', label: 'Sync CRM', tools: ['hubspot'],
    minutes: 6, worked: 5.5, start: -26, end: -20.5, state: 'failed', inputTokens: 22_000, outputTokens: 1_100,
    log: ['Pulled 1,204 contacts', 'Stopped: the CRM rate-limited the sync'],
  }),
  historyTask({
    id: 'history-keys', agent: 'ops', model: 'gemini-3.8-flash', label: 'Rotate API keys', tools: ['stripe', 'github'],
    minutes: 4, worked: 3, start: -6, end: null, state: 'waiting', approval: 'always',
    gatePassed: true, asked: true, waitingSince: -2, inputTokens: 9_000, outputTokens: 700,
    gateText: 'wants to rotate the live payment keys',
    log: ['Created new keys in Stripe', 'Updated 3 GitHub secrets', 'Ready to switch live traffic'],
  }),
]
