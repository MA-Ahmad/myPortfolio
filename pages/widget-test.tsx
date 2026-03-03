"use client";

import React from "react";
import { Box, Button, Heading, VStack } from "@chakra-ui/react";

export default function SwitchboardOnboardingWidget() {
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