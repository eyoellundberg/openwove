import type { Provider } from './types'

export interface ModelInfo {
  id: string
  label: string
  provider: Provider
  /** US dollars per million tokens. */
  inputPerM: number
  outputPerM: number
  /** True when the price is the provider's published list price; false for an example price. */
  listPrice: boolean
}

/** Anthropic prices are the published list prices (October 2026). The others are placeholders until those runners exist. */
export const MODELS: ModelInfo[] = [
  { id: 'claude-opus-5-5', label: 'Opus 5.5', provider: 'anthropic', inputPerM: 4, outputPerM: 20, listPrice: true },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', provider: 'anthropic', inputPerM: 2, outputPerM: 10, listPrice: true },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5', provider: 'anthropic', inputPerM: 0.1, outputPerM: 0.5, listPrice: true },
  { id: 'gpt-6-sol', label: 'GPT-6 Sol', provider: 'openai', inputPerM: 3, outputPerM: 15, listPrice: false },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', provider: 'google', inputPerM: 0.3, outputPerM: 2.5, listPrice: false },
]

export function modelInfo(id: string, provider: Provider = 'anthropic'): ModelInfo {
  return MODELS.find((m) => m.id === id) ?? { id, label: id, provider, inputPerM: 0, outputPerM: 0, listPrice: false }
}

export const costOf = (model: string, inputTokens: number, outputTokens: number) => {
  const m = modelInfo(model)
  return (inputTokens * m.inputPerM + outputTokens * m.outputPerM) / 1_000_000
}

/** "$0.04", or "<$0.01" for tiny amounts; "~" marks a cost built on example prices. */
export function formatCost(dollars: number, estimated = false) {
  const prefix = estimated ? '~' : ''
  if (dollars > 0 && dollars < 0.01) return `${prefix}<$0.01`
  return `${prefix}$${dollars.toFixed(2)}`
}
