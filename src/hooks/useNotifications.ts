import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "stellarlock:notifications"

export interface NotificationPrefs {
  lockId: string
  browser: boolean
  webhookUrl?: string
}

function loadPrefs(): Record<string, NotificationPrefs> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")
  } catch {
    return {}
  }
}

function savePrefs(prefs: Record<string, NotificationPrefs>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

export function useNotificationPrefs(lockId: string) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => {
    const all = loadPrefs()
    return all[lockId] ?? { lockId, browser: false }
  })

  const update = useCallback(
    (patch: Partial<NotificationPrefs>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch, lockId }
        const all = loadPrefs()
        all[lockId] = next
        savePrefs(all)
        return next
      })
    },
    [lockId],
  )

  return { prefs, update }
}

export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  )

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "denied" as const
    const result = await Notification.requestPermission()
    setPermission(result)
    return result
  }, [])

  return { permission, requestPermission }
}

export function scheduleUnlockReminder(lockId: string, unlockAt: number) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return

  const now = Date.now()
  const oneDay = 24 * 60 * 60 * 1000
  const sevenDays = 7 * oneDay

  const reminders = [
    { delay: unlockAt - sevenDays - now, label: "7 days" },
    { delay: unlockAt - oneDay - now, label: "1 day" },
    { delay: unlockAt - now, label: "now" },
  ]

  for (const { delay, label } of reminders) {
    if (delay > 0 && delay < 2_147_483_647) {
      setTimeout(() => {
        new Notification("StellarLock", {
          body:
            label === "now"
              ? `Lock #${lockId} has unlocked! You can now withdraw your tokens.`
              : `Lock #${lockId} unlocks in ${label}.`,
          icon: "/favicon.svg",
        })
      }, delay)
    }
  }
}

export interface WebhookPayload {
  event: "unlock_reminder" | "unlocked"
  lockId: string
  unlockAt: number
  reminderDays?: number
}

export async function sendWebhook(url: string, payload: WebhookPayload): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch {
    return false
  }
}
