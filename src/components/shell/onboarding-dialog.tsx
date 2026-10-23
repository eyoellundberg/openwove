import { useState } from 'react'
import { KeyList } from '@/components/shell/key-list'
import { ProfileFields } from '@/components/shell/profile-fields'
import { WeaveIntro } from '@/components/shell/weave-intro'
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
  const startDemo = useFlow((s) => s.startDemo)
  const [step, setStep] = useState<'intro' | 'you' | 'keys'>('intro')
  const [draft, setDraft] = useState<Profile>(() => ({ company: '', ...guessPlace() }))

  return (
    <Dialog open={checked && !profile}>
      <DialogContent showCloseButton={false} className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogTitle className="sr-only">Welcome to OpenWove</DialogTitle>
        {step === 'intro' ? (
          <>
            <DialogDescription className="sr-only">A short welcome, then two quick questions, or a demo first.</DialogDescription>
            <WeaveIntro
              onContinue={() => setStep('you')}
              onDemo={() => {
                // Their country and language are best guesses here; Settings has them if they want to change them.
                startDemo()
                save(draft)
              }}
            />
          </>
        ) : step === 'you' ? (
          <>
            <div className="flex flex-col gap-1">
              <h2 className="text-base leading-none font-medium">A little about you</h2>
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
              <h2 className="text-base leading-none font-medium">Add a key</h2>
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
