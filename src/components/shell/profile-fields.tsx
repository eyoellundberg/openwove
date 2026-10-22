import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { COUNTRIES, LANGUAGES } from '@/lib/places'
import type { Profile } from '@/lib/runner-client'

/** Company, country and language. Agents get these as context, so they write for you. */
export function ProfileFields({ value, onChange }: { value: Profile; onChange: (profile: Profile) => void }) {
  const set = (patch: Partial<Profile>) => onChange({ ...value, ...patch })
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="company">Company or project</Label>
        <Input id="company" value={value.company} placeholder="Northwind Coffee" maxLength={100} onChange={(e) => set({ company: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="country">Where are you?</Label>
        <Select value={value.country} onValueChange={(country) => set({ country })}>
          <SelectTrigger id="country" className="w-full">
            <SelectValue placeholder="Choose a country" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="language">Language agents write in</Label>
        <Select value={value.language} onValueChange={(language) => set({ language })}>
          <SelectTrigger id="language" className="w-full">
            <SelectValue placeholder="Choose a language" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
