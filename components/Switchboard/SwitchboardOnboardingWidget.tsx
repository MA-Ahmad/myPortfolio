/* SwitchboardOnboardingWidget.tsx (drop-in updated, with comments)
   Goal:
   1) Inject script once
   2) After app tab switch (component remount), re-bind widget click handler via __SWB_WIDGET_REINIT__
   3) Button always shows, and opens exactly one systems dialog
*/

'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Heading, VStack } from '@chakra-ui/react'

export default function SwitchboardOnboardingWidget() {
  const scriptRef = useRef<HTMLScriptElement | null>(null)
  const [ready, setReady] = useState(false)

  // Build src once using URL params
  const src = useMemo(() => {
    if (typeof window === 'undefined') return ''

    const selectorId = 'button1'
    const url = new URLSearchParams(window.location.search)

    const widgetHost = (
      url.get('widgetHost') || 'https://widget.dev.switchboardcloud.com.au'
    ).replace(/\/+$/, '')

    const hostingProviderId =
      url.get('hostingProviderId') || 'e5dd5414-4b7e-46e1-96de-e88c9e708497'

    const email = url.get('email') || 'test@example.com'
    const companyName = url.get('companyName') || 'StockTrimPartner1'

    const apiAuthSignature = url.get('api-auth-signature') || 'swb'
    const apiAuthId = url.get('api-auth-id') || '1234'

    const apiKeys = {
      'api-auth-signature': apiAuthSignature,
      'api-auth-id': apiAuthId
    }

    const operations =
      '{"ProductList":"CreateProducts","SalesOrderList":"CreateSalesOrder","BillOfMaterialsList":"CreateBillOfMaterials"}'

    const qs = new URLSearchParams({
      selectorID: selectorId,
      email,
      companyName,
      system: 'Odoo V14+',
      operations,
      hostedOperationIntegrations: '{}',
      hostingProviderId,
      apiKeys: JSON.stringify(apiKeys),
      managedConfiguration: 'true'
    })

    return `${widgetHost}/sbc-widget.bundle.js?${qs.toString()}&ahhah=shshsh`
  }, [])

  useEffect(() => {
    if (!src || typeof window === 'undefined') return

    const container = document.getElementById(
      'switchboard_openSystemsButtonContainer_widget'
    )

    // Always show container on mount
    if (container) container.style.display = 'flex'

    // If script exists already (tab switch remount), just re-init and mark ready
    let script = document.getElementById(
      'switchboard-widget-script'
    ) as HTMLScriptElement | null

    const callReinit = () => {
      const reinit = (window as any).__SWB_WIDGET_REINIT__
      if (typeof reinit === 'function') {
        reinit()
      } else {
        // fallback for older versions
        document.dispatchEvent(new Event('readystatechange'))
      }
    }

    if (script) {
      // IMPORTANT:
      // Script already loaded, so we must re-bind click handler after remount
      callReinit()
      scriptRef.current = script
      setReady(true)
      return
    }

    // Script not present, inject once
    script = document.createElement('script')
    script.id = 'switchboard-widget-script'
    script.src = src
    script.async = true

    script.onload = () => {
      // IMPORTANT:
      // Our updated bundle will boot itself, but we can still call reinit safely
      callReinit()
      setReady(true)
    }

    script.onerror = () => {
      console.error('[widget] failed to load', src)
      setReady(false)
    }

    document.body.appendChild(script)
    scriptRef.current = script

    return () => {
      // IMPORTANT:
      // Do NOT remove the script on unmount,
      // Next.js tabs often remount, and removing script causes handler issues.
      // We rely on __SWB_WIDGET_REINIT__ after remount.
    }
  }, [src])

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()

    const openBtn = document.getElementById(
      'switchboard_openSystemsButton_widget'
    ) as HTMLButtonElement | null

    if (!openBtn) return

    // If handler missing after remount, reinit and retry
    if (typeof openBtn.onclick !== 'function') {
      const reinit = (window as any).__SWB_WIDGET_REINIT__
      if (typeof reinit === 'function') {
        reinit()
        window.setTimeout(() => {
          openBtn.click()
        }, 50)
        return
      }
    }

    openBtn.click()
  }

  return (
    <VStack align="start" spacing={4}>
      <Heading size="md">Customer Onboarding Widget</Heading>

      {/* REQUIRED: selector container that bundle looks for via selectorID */}
      <Box display="flex" flexWrap="wrap">
        <Box id="button1" m="10px" />
      </Box>

      {/* REQUIRED: keep this container id (you asked not to remove it) */}
      <Box
        id="switchboard_openSystemsButtonContainer_widget"
        display="flex"
        justifyContent="center"
        mt="20px"
        w="full"
      >
        <Button
          id="switchboard_openSystemsButton_widget"
          bg="rgb(0, 51, 102)"
          color="white"
          px={6}
          py={6}
          w="300px"
          borderRadius="8px"
          onClick={handleClick}
          isDisabled={!ready}
        >
          Select your system to integrate
        </Button>
      </Box>
    </VStack>
  )
}