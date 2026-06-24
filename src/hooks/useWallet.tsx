import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { isConnected, requestAccess, getAddress, signTransaction as freighterSignTx } from "@stellar/freighter-api"
import { trackEvent } from "@/lib/analytics"

const STORAGE_KEY = "stellarlock:wallet"
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"

interface WalletContextValue {
  address: string | null
  isConnected: boolean
  connecting: boolean
  connect: () => Promise<void>
  disconnect: () => void
  signTransaction: (xdr: string) => Promise<{ signedTxXdr: string }>
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  // Restore persisted session and verify it's still accessible
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    // Check freighter is still connected before restoring
    isConnected()
      .then((res) => {
        if (res.isConnected) {
          setAddress(saved)
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      })
      .catch(() => localStorage.removeItem(STORAGE_KEY))
  }, [])

  const connect = useCallback(async () => {
    setConnecting(true)
    try {
      const connected = await isConnected()
      if (!connected.isConnected) {
        alert("Freighter extension not found. Please install it from freighter.app")
        return
      }
      // requestAccess opens the Freighter popup for the user to approve
      const accessResult = await requestAccess()
      if (accessResult.error) {
        throw new Error(accessResult.error)
      }
      const addrResult = await getAddress()
      if (addrResult.error) {
        throw new Error(addrResult.error)
      }
      setAddress(addrResult.address)
      localStorage.setItem(STORAGE_KEY, addrResult.address)
      trackEvent("wallet_connect")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("Wallet connect error:", msg)
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setAddress(null)
    localStorage.removeItem(STORAGE_KEY)
    trackEvent("wallet_disconnect")
  }, [])

  const signTransaction = useCallback(
    async (xdr: string): Promise<{ signedTxXdr: string }> => {
      if (!address) throw new Error("Wallet not connected")
      const result = await freighterSignTx(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address,
      })
      if (import.meta.env.DEV) console.log("[signTransaction result]", result)
      if (result.error) {
        const errMsg =
          typeof result.error === "string"
            ? result.error
            : ((result.error as { message?: string }).message ?? JSON.stringify(result.error))
        throw new Error(errMsg)
      }
      if (!result.signedTxXdr) throw new Error("Freighter returned empty transaction — did you approve it?")
      return { signedTxXdr: result.signedTxXdr }
    },
    [address],
  )

  const value = useMemo<WalletContextValue>(
    () => ({ address, isConnected: !!address, connecting, connect, disconnect, signTransaction }),
    [address, connecting, connect, disconnect, signTransaction],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider")
  return ctx
}
