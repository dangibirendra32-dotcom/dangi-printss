import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dangiprint.app',
  appName: 'Dangi Print',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
