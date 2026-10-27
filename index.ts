// The background push task must be defined before the app loads, since it
// also runs without the UI (see src/notifications/backgroundSync.ts)
import './src/notifications/backgroundSync';
import 'expo-router/entry';
