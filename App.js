// Expo default entrypoint (`node_modules/expo/AppEntry.js`) expects a default export from `./App`.
// This repo is a monorepo and the mobile app lives in `apps/mobile/src/App.tsx`.
import { App as MobileApp } from "./apps/mobile/src/App";

export default MobileApp;

