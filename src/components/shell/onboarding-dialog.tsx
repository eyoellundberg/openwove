import { useState } from 'react'
import { Logo } from '@/components/shared/logo'
import { KeyList } from '@/components/shell/key-list'
import { ProfileFields } from '@/components/shell/profile-fields'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { guessPlace } from '@/lib/places'
import type { Profile } from '@/lib/runner-client'
import { useFlow } from '@/lib/store'

/** The first thing you see: two short steps, both skippable. Shown until a profile has been saved once. */
export function OnboardingDialog() {
  const profile = useFlow((s) => s.profile)
  const checked = useFlow((s) => s.profileChecked)
  const save = useFlow((s) => s.saveProfile)
  const [step, setStep] = useState<'you' | 'keys'>('you')
  const [draft, setDraft] = useState<Profile>(() => ({ company: '', ...guessPlace() }))

  return (
    <Dialog open={checked && !profile}>
      <DialogContent showCloseButton={false} className="sm:max-w-md" onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo className="size-5" />
          OpenWove
        </div>
        {step === 'you' ? (
          <>
            <div className="flex flex-col gap-1">
              <DialogTitle>A little about you</DialogTitle>
              <DialogDescription>Your agents get this as context, so they write for you. It stays on this computer.</DialogDescription>
            </div>
            <ProfileFields value={draft} onChange={setDraft} />
            <div className="flex justify-end">
              <Button onClick={() => setStep('keys')}>Next</Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <DialogTitle>Add a key</DialogTitle>
              <DialogDescription>Add any you have. Without one you can still try everything with simulated runs.</DialogDescription>
            </div>
            <KeyList />
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('you')}>
                Back
              </Button>
              <Button onClick={() => save(draft)}>Start</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
