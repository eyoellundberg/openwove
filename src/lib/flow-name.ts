/** A safe file name inside flows/, from a flow's name or a file name someone typed: "Lumen landing page" → "lumen-landing-page.json". */
export function flowFileName(nameOrFile: string): string {
  const slug = (nameOrFile.split('/').pop() ?? '')
    .replace(/\.json$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'flow'}.json`
}
