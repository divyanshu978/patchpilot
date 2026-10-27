/**
 * Start an Express app on an ephemeral port and return its base URL.
 */
export async function startServer(app) {
  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

export async function stopServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

/** Poll until `check` returns truthy or the timeout elapses. */
export async function waitFor(check, { timeoutMs = 3000, intervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}