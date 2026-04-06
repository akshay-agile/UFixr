const os = require('os');
const { spawn } = require('child_process');

function pickHostIp() {
  if (process.env.EXPO_HOST_IP) {
    return process.env.EXPO_HOST_IP;
  }

  const nets = os.networkInterfaces();
  const candidates = [];

  for (const [name, addresses] of Object.entries(nets)) {
    if (!addresses) continue;

    for (const addr of addresses) {
      if (addr.family !== 'IPv4' || addr.internal) continue;

      // Prefer private LAN ranges and physical adapters.
      const isPrivate =
        addr.address.startsWith('10.') ||
        addr.address.startsWith('172.') ||
        addr.address.startsWith('192.168.');
      const lowered = name.toLowerCase();
      const isVirtual =
        lowered.includes('virtual') ||
        lowered.includes('vmware') ||
        lowered.includes('veth') ||
        lowered.includes('loopback') ||
        lowered.includes('docker') ||
        lowered.includes('wsl');
      const score =
        (isPrivate ? 5 : 0) +
        (lowered.includes('wi-fi') || lowered.includes('wifi') ? 4 : 0) +
        (lowered.includes('ethernet') ? 3 : 0) +
        (isVirtual ? -4 : 0);

      candidates.push({ name, address: addr.address, score });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].address;
}

function toShellCommand(args) {
  return `npx ${args.join(' ')}`;
}

function runExpoOnce(hostMode, hostIp, passThroughArgs, env) {
  return new Promise((resolve) => {
    const args = ['expo', 'start', '--host', hostMode, '--port', '8081', ...passThroughArgs];
    const command = toShellCommand(args);
    const shell = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : '/bin/sh';
    const shellArgs = process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-lc', command];

    console.log(`Starting Expo with host mode: ${hostMode}`);
    if (hostIp) {
      console.log(`Using Expo host IP: ${hostIp}`);
    }

    const child = spawn(shell, shellArgs, {
      stdio: 'inherit',
      env,
    });

    child.on('exit', (code, signal) => {
      resolve({ code: code ?? 1, signal });
    });
  });
}

async function main() {
  const hostIp = pickHostIp();
  const passThroughArgs = process.argv.slice(2);
  const requestedMode = (process.env.EXPO_NETWORK_MODE || 'auto').toLowerCase();
  const mode = requestedMode === 'lan' || requestedMode === 'tunnel' || requestedMode === 'localhost'
    ? requestedMode
    : 'auto';

  const env = {
    ...process.env,
    EXPO_DEVTOOLS_LISTEN_ADDRESS: '0.0.0.0',
  };

  if (hostIp) {
    env.REACT_NATIVE_PACKAGER_HOSTNAME = hostIp;
  }

  // Keep mobile API URL in sync with current machine IP unless user sets a public API URL.
  if (!env.EXPO_PUBLIC_API_BASE_URL && hostIp) {
    env.EXPO_PUBLIC_API_BASE_URL = `http://${hostIp}:8000`;
    console.log(`Auto API base URL: ${env.EXPO_PUBLIC_API_BASE_URL}`);
  }

  const attempts = mode === 'auto' ? ['tunnel', 'lan'] : [mode];

  for (let i = 0; i < attempts.length; i += 1) {
    const hostMode = attempts[i];
    const result = await runExpoOnce(hostMode, hostIp, passThroughArgs, env);

    // User intentionally stopped Expo.
    if (result.signal) {
      process.exit(0);
    }

    const shouldFallback = mode === 'auto' && hostMode === 'tunnel' && result.code !== 0;
    if (shouldFallback) {
      console.log('Tunnel mode failed. Falling back to LAN mode automatically.');
      continue;
    }

    process.exit(result.code);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
