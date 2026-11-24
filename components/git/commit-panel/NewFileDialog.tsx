'use client'

import React from 'react'

import { useT } from '@/components/i18n/LocaleProvider'
import { Button, TextInput } from '@/components/sk'

export interface NewFileDialogProps {
  dialog: { folderPath: string; fileName: string }
  onClose: () => void
  onChangeName: (name: string) => void
  onSubmit: () => void | Promise<void>
}

export function NewFileDialog({ dialog, onClose, onChangeName, onSubmit }: NewFileDialogProps) {
  const t = useT()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-80 rounded-lg border border-line bg-panel p-3.5 shadow-xl flex flex-col gap-2.5">
        <h3 className="m-0 text-xs font-semibold text-ink">
          {(t('git.operations.createFileInFolder') || 'Create file in {folder}').replace('{folder}', dialog.folderPath || '/')}
        </h3>
        <TextInput
          autoFocus
          value={dialog.fileName}
          placeholder={t('git.operations.createFileInFolder') || 'Enter file name (e.g. index.ts)...'}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChangeName(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void onSubmit()
            } else if (e.key === 'Escape') {
              onClose()
            }
          }}
        />
        <div className="flex justify-end gap-1.5 pt-1">
          <Button variant="plain" size="xs" onClick={onClose}>
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button variant="accent" size="xs" disabled={!dialog.fileName.trim()} onClick={() => void onSubmit()}>
            {t('git.project.create') || 'Create File'}
          </Button>
        </div>
      </div>
    </div>
  )
}
