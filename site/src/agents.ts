/** Who the demo's agents are, and what colors and logos they wear. Shared by the still previews and the working demo. */
import { ChatGptIcon, ClaudeIcon, FigmaIcon, GithubIcon, GoogleGeminiIcon, NotionIcon, SlackIcon } from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'

export type Tone = 'running' | 'waiting' | 'earned' | 'failed' | 'muted'

export const TONE: Record<Tone, string> = {
  running: 'bg-running-subtle text-running',
  waiting: 'bg-waiting-subtle text-waiting',
  earned: 'bg-earned-subtle text-earned',
  failed: 'bg-failed-subtle text-failed',
  muted: 'bg-muted text-muted-foreground',
}

/** Each agent runs on a different provider, so the logos differ like they do in the app. */
export const BRAND = {
  claude: { icon: ClaudeIcon, className: 'bg-vendor-anthropic text-white' },
  chatgpt: { icon: ChatGptIcon, className: 'bg-vendor-openai text-background' },
  gemini: { icon: GoogleGeminiIcon, className: 'bg-vendor-google text-white' },
}
export type Brand = keyof typeof BRAND

export const TOOLS: Record<string, IconSvgElement> = { notion: NotionIcon, slack: SlackIcon, figma: FigmaIcon, github: GithubIcon }

export const AGENTS = {
  researcher: { brand: 'claude' as Brand, name: 'Researcher' },
  writer: { brand: 'claude' as Brand, name: 'Writer' },
  reviewer: { brand: 'chatgpt' as Brand, name: 'Reviewer' },
  ops: { brand: 'gemini' as Brand, name: 'Ops' },
}
export type Who = keyof typeof AGENTS

