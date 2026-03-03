'use client';

import React, { useEffect, useRef } from 'react';
import { Box, Button, Heading, VStack } from '@chakra-ui/react';

export default function SwitchboardOnboardingWidget() {
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const selectorId = 'button1';

    const url = new URLSearchParams(window.location.search);

    const widgetHost = (
      url.get('widgetHost') || 'https://widget.dev.switchboardcloud.com.au'
    ).replace(/\/+$/, '');

    const hostingProviderId =
      url.get('hostingProviderId') || 'e5dd5414-4b7e-46e1-96de-e88c9e708497';

    const email = url.get('email') || 'test@example.com';
    const companyName = url.get('companyName') || 'StockTrimPartner1';

    const apiAuthSignature = url.get('api-auth-signature') || 'swb';
    const apiAuthId = url.get('api-auth-id') || '1234';

    const apiKeys = {
      'api-auth-signature': apiAuthSignature,
      'api-auth-id': apiAuthId
    };

    const operations =
      '{"ProductList":"CreateProducts","SalesOrderList":"CreateSalesOrder","BillOfMaterialsList":"CreateBillOfMaterials"}';

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
    });

    const src = `${widgetHost}/sbc-widget.bundle.js?${qs.toString()}`;

    const script = document.createElement('script');
    script.src = src;
    script.async = true;

    script.onload = () => {
      console.log('[widget] loaded');
      document.dispatchEvent(new Event('readystatechange'));
      const container = document.getElementById('switchboard_openSystemsButtonContainer_widget');
      if (container) container.style.display = 'flex';
    };

    script.onerror = () => {
      console.error('[widget] failed to load', src);
    };

    document.body.appendChild(script);
    scriptRef.current = script;

    return () => {
      if (scriptRef.current) {
        scriptRef.current.remove();
        scriptRef.current = null;
      }
    };
  }, []);

  return (
    <VStack align="start" spacing={4}>
      <Heading size="md">Customer Onboarding Widget</Heading>

      <Box display="flex" flexWrap="wrap">
        <Box id="button1" m="10px" />
      </Box>

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
        >
          Select your system to integrate
        </Button>
      </Box>
    </VStack>
  );
}
