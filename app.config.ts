/**
 * Adds to app.json what depends on .env.local / EAS environment variables.
 * Google Sign-In on iOS returns to the app through the iOS client ID's
 * reversed form as a URL scheme, so its config plugin needs that ID at build
 * time. Without it the plugin is left out and the sign-in screen says so.
 */
import type { ConfigContext, ExpoConfig } from 'expo/config';

const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/** 123-abc.apps.googleusercontent.com → com.googleusercontent.apps.123-abc */
function reversedClientId(clientId: string): string {
  return clientId.split('.').reverse().join('.');
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    ...(IOS_CLIENT_ID
      ? [
          [
            '@react-native-google-signin/google-signin',
            { iosUrlScheme: reversedClientId(IOS_CLIENT_ID) },
          ] as [string, unknown],
        ]
      : []),
  ],
});
