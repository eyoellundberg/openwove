/** Countries and languages for the welcome and Settings, named by the browser in the person's own language. */

const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' })
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Every country the browser can name, A to Z. Unknown codes come back as themselves, so they're dropped. */
export const COUNTRIES = [...LETTERS]
  .flatMap((a) => [...LETTERS].map((b) => a + b))
  .map((code) => ({ code, name: REGION_NAMES.of(code) ?? code }))
  .filter((c) => c.name !== c.code)
  .sort((a, b) => a.name.localeCompare(b.name))

const LANGUAGE_CODES = ['en', 'sv', 'no', 'da', 'fi', 'de', 'nl', 'fr', 'es', 'pt', 'it', 'pl', 'tr', 'ar', 'hi', 'id', 'ja', 'ko', 'zh']

/** Each language written in itself ("Svenska"), so people find theirs. */
export const LANGUAGES = LANGUAGE_CODES.map((code) => {
  const own = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code
  return { code, name: own.charAt(0).toLocaleUpperCase(code) + own.slice(1) }
})

/** Best guesses from the computer's own settings. */
export function guessPlace(): { country: string; language: string } {
  const locale = new Intl.Locale(navigator.language)
  const country = locale.region && COUNTRIES.some((c) => c.code === locale.region) ? locale.region : ''
  const language = LANGUAGE_CODES.includes(locale.language) ? locale.language : 'en'
  return { country, language }
}
