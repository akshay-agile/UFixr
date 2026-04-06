import Constants from "expo-constants";

type LooseExpoConstants = {
  expoConfig?: { hostUri?: string };
  manifest?: { debuggerHost?: string };
  manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
};

function readPublicEnv(name: string): string | undefined {
  const maybeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return maybeEnv?.[name];
}

function getExpoDebugHost(): string | null {
  const loose = Constants as unknown as LooseExpoConstants;
  const hostWithPort =
    loose.expoConfig?.hostUri ||
    loose.manifest2?.extra?.expoGo?.debuggerHost ||
    loose.manifest?.debuggerHost;

  if (!hostWithPort) {
    return null;
  }

  const [host] = hostWithPort.split(":");
  return host || null;
}

function getApiBaseUrl(): string {
  const explicit = readPublicEnv("EXPO_PUBLIC_API_BASE_URL");
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const host = getExpoDebugHost();
  if (host) {
    return `http://${host}:8000`;
  }

  // Emulator fallback when no Expo host metadata is available.
  return "http://127.0.0.1:8000";
}

export const API_BASE_URL = getApiBaseUrl();
