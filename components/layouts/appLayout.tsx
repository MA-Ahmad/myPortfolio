"use client";

import { Fragment, useEffect, useRef } from "react";
import { Box } from "@chakra-ui/react";
import TopNav from "../shared/top-nav";
import Footer from "../shared/footer";
import styles from "./appLayout.module.css";

const SCRIPT_ID = "sbc-widget-script";

function cleanupDialogs() {
  // remove leftover dialogs if you want to avoid duplicates
  document.querySelectorAll("#systemsDialog").forEach((n) => n.remove());
}

function AppLayout(props: { children: React.ReactNode }) {
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // optional: cleanup old dialogs once, helps after HMR or weird navigation
    cleanupDialogs();

    // only inject once
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) return;

    const selectorId = "button1";
    const url = new URLSearchParams(window.location.search);

    const widgetHost = (
      url.get("widgetHost") || "https://widget.dev.switchboardcloud.com.au"
    ).replace(/\/+$/, "");

    const hostingProviderId =
      url.get("hostingProviderId") || "e5dd5414-4b7e-46e1-96de-e88c9e708497";

    const email = url.get("email") || "test@example.com";
    const companyName = url.get("companyName") || "StockTrimPartner1";

    const apiAuthSignature = url.get("api-auth-signature") || "swb";
    const apiAuthId = url.get("api-auth-id") || "1234";

    const apiKeys = {
      "api-auth-signature": apiAuthSignature,
      "api-auth-id": apiAuthId
    };

    const operations =
      '{"ProductList":"CreateProducts","SalesOrderList":"CreateSalesOrder","BillOfMaterialsList":"CreateBillOfMaterials"}';

    const qs = new URLSearchParams({
      selectorID: selectorId,
      email,
      companyName,
      system: "Odoo V14+",
      operations,
      hostedOperationIntegrations: "{}",
      hostingProviderId,
      apiKeys: JSON.stringify(apiKeys),
      managedConfiguration: "true"
    });

    const src = `${widgetHost}/sbc-widget.bundle.js?${qs.toString()}`;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = src;
    script.async = true;

    script.onload = () => {
      console.log("[widget] loaded");
      document.dispatchEvent(new Event("readystatechange"));
    };

    script.onerror = () => {
      console.error("[widget] failed to load", src);
    };

    document.body.appendChild(script);
    scriptRef.current = script;

    // IMPORTANT: since this is layout, usually do NOT remove script on unmount,
    // because layout stays mounted. If you remove, it can re inject again.
    return () => {
      // optional cleanup dialogs only
      cleanupDialogs();
    };
  }, []);

  return (
    <Fragment>
      <TopNav />
      <DottedSvgs />
      <Box textAlign="center" fontSize="xl" w={["90%", "85%", "80%"]} maxW={800} mx="auto">
        <Box pt={"7rem"} pb={10}>
          {props.children}
        </Box>
      </Box>
      <Footer />
    </Fragment>
  );
}

function DottedSvgs() {
  return (
    <Box
      position="absolute"
      height="50rem"
      width="100%"
      overflow="hidden"
      display={["none", "none", "block"]}
      zIndex={-1}
    >
      <Box position="relative" height="full" mx="auto" maxW="940px">
        <Box position="absolute" left="100%">
          <svg
            className={`${styles.dottedRightTransform} ${styles.dottedColor}`}
            color="rgba(55,65,81, 1)"
            width="404"
            height="784"
            fill="none"
            viewBox="0 0 404 784"
          >
            <defs>
              <pattern
                id="5d0dd344-b041-4d26-bec4-8d33ea57ec9b"
                x="0"
                y="0"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <rect x="0" y="0" width="4" height="4" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="404" height="784" fill="url(#5d0dd344-b041-4d26-bec4-8d33ea57ec9b)" />
          </svg>
        </Box>

        <Box position="absolute" right="100%">
          <svg
            className={`${styles.dottedLeftTransform}`}
            color="rgba(55,65,81, 1)"
            width="404"
            height="784"
            fill="none"
            viewBox="0 0 404 784"
          >
            <defs>
              <pattern
                id="5d0dd344-b041-4d26-bec4-8d33ea57ec9b"
                x="0"
                y="0"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <rect x="0" y="0" width="4" height="4" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="404" height="784" fill="url(#5d0dd344-b041-4d26-bec4-8d33ea57ec9b)" />
          </svg>
        </Box>
      </Box>
    </Box>
  );
}

export default AppLayout;