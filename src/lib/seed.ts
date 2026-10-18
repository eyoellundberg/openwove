import { AGENT_BY_ID } from './catalog'
import type { AgentId, Step, Task } from './types'

let stepCounter = 0
export const newStepId = () => `step-${++stepCounter}`

export function makeStep(agent: AgentId, patch: Partial<Step> = {}): Step {
  const task = patch.task ?? 'New step'
  return {
    id: newStepId(),
    agent,
    task,
    prompt: defaultPrompt(task),
    promptEdited: false,
    tools: AGENT_BY_ID[agent].tools,
    minutes: 5,
    mode: 'after',
    approval: 'never',
    streak: 0,
    ...patch,
  }
}

export const defaultPrompt = (task: string) =>
  `Your job: ${task || 'this step'}.\n\nUse what the previous step produced. When you are done, write a short note on what you did and anything you were unsure about.`

/** What the user asked their agent for; the flow below is what it set up. */
export const ORIGIN_REQUEST =
  'Refresh our pricing page from what competitors charge. Let me OK anything before it goes live.'

export const SETUP_PROMPT = `${ORIGIN_REQUEST}

Set this up as a flow in Agent Flow:
- Split the work into steps, one agent per step.
- Pick the agent and the tools each step needs.
- Write each step's prompt in plain language.
- Anything that publishes, pays or deletes: ask me first until it has earned it.`

export const initialSteps = (): Step[] => [
  makeStep('researcher', {
    task: 'Competitor pricing',
    minutes: 6,
    prompt:
      'Find the current prices of the 9 competitors in our Notion list “Competitors”.\n\nFor each plan, write down the plan name, the monthly price, and what is included. Put it all in the Notion table “Competitor pricing”.\n\nFlag anything that changed since last month.',
    log: ['Searched 9 competitor sites', 'Pulled every plan into a Notion table', 'Flagged 3 price changes this quarter'],
  }),
  makeStep('writer', {
    task: 'Draft pricing page',
    minutes: 8,
    prompt:
      'Using the “Competitor pricing” table, draft our new pricing page: a headline, three plan cards and a short FAQ.\n\nKeep our current prices. Write plainly, no hype. Match the layout of the Figma frame “Pricing / v3”.',
    log: ['Read the competitor table', 'Wrote the headline and 3 plan cards', 'Matched the copy to the Figma frame'],
  }),
  makeStep('researcher', {
    task: 'Customer quotes',
    minutes: 7,
    mode: 'with',
    tools: ['notion', 'slack'],
    prompt:
      'Read the last 14 customer interview notes in Notion. Pull out short quotes about price and value, and group them by theme so the Writer can use them on the page.',
    log: ['Read 14 interview notes', 'Grouping quotes by theme', 'Picked 6 quotes for the page'],
  }),
  makeStep('reviewer', {
    task: 'Review and publish',
    minutes: 5,
    approval: 'earned',
    gateText: 'wants to publish the pricing page',
    prompt:
      'Check every price on the draft against the “Competitor pricing” table and our own price list. Fix typos.\n\nWhen it is right, publish the page and post a two-line summary in #launches on Slack.',
    log: ['Checked prices against the table', 'Fixed 2 typos', 'Ready to publish'],
  }),
]

/** Work that happened before the page opened, so the timeline isn't empty. */
export const initialHistory = (): Task[] => [
  {
    id: 'history-inbox', agent: 'researcher', label: 'Inbox digest', tools: ['gmail', 'notion'],
    minutes: 7, worked: 7, start: -27, end: -20, state: 'done', approval: 'never',
    gatePassed: false, asked: false, actedAlone: false, gateText: '',
    log: ['Read 41 unread emails', 'Summed up 6 that need replies'],
  },
  {
    id: 'history-pr', agent: 'reviewer', label: 'PR #482 billing', tools: ['github', 'linear'],
    minutes: 18, worked: 18, start: -36, end: -18, state: 'done', approval: 'never',
    gatePassed: false, asked: false, actedAlone: false, gateText: '',
    log: ['Reviewed 12 changed files', 'Left 4 comments', 'Approved after fixes'],
  },
  {
    id: 'history-crm', agent: 'ops', label: 'Sync CRM', tools: ['hubspot'],
    minutes: 6, worked: 5.5, start: -26, end: -20.5, state: 'failed', approval: 'never',
    gatePassed: false, asked: false, actedAlone: false, gateText: '',
    log: ['Pulled 1,204 contacts', 'Stopped: the CRM rate-limited the sync'],
  },
  {
    id: 'history-keys', agent: 'ops', label: 'Rotate API keys', tools: ['stripe', 'github'],
    minutes: 4, worked: 3, start: -6, end: null, state: 'waiting', approval: 'always',
    gatePassed: true, asked: true, actedAlone: false, waitingSince: -2,
    gateText: 'wants to rotate the live payment keys',
    log: ['Created new keys in Stripe', 'Updated 3 GitHub secrets', 'Ready to switch live traffic'],
  },
]
