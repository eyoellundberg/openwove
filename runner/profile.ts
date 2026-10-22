/** What the person said about themselves: saved in their folder and handed to every agent as context. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Profile } from '../src/lib/runner-types'
import { ROOT } from './flows'

const FILE = join(ROOT, 'profile.json')

export function readProfile(): Profile | null {
  if (!existsSync(FILE)) return null
  try {
    return JSON.parse(readFileSync(FILE, 'utf8')) as Profile
  } catch {
    return null
  }
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 100) : '')

export function writeProfile(input: unknown): Profile {
  const p = (input ?? {}) as Partial<Profile>
  const profile = { company: text(p.company), country: text(p.country), language: text(p.language) }
  writeFileSync(FILE, `${JSON.stringify(profile, null, 2)}\n`)
  return profile
}

/** A short paragraph for the system prompt; empty if they said nothing. */
export function profileContext(profile: Profile | null): string {
  if (!profile) return ''
  const names = (type: 'region' | 'language', code: string) => (code ? new Intl.DisplayNames(['en'], { type }).of(code) : '')
  const lines = [
    profile.company && `The person works at ${profile.company}.`,
    profile.country && `They are in ${names('region', profile.country)}, so use local spelling, dates and currency where it matters.`,
    profile.language && `Write in ${names('language', profile.language)} unless the task says otherwise.`,
  ].filter(Boolean)
  return lines.join(' ')
}
