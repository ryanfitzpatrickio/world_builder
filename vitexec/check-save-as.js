async function waitFor(predicate, label, timeoutMs = 5000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const debug = await waitFor(() => window.levelMakerDebug, 'levelMakerDebug');
const input = document.querySelector('#level-name');
if (!input) throw new Error('Missing level name input');

const originalFetch = window.fetch;
const posts = [];
window.fetch = async (url, options = {}) => {
  if (String(url) === '/api/levels' && options.method === 'POST') {
    const body = JSON.parse(options.body);
    posts.push(body);
    return new Response(
      JSON.stringify({
        saved: true,
        metadata: {
          filename: body.filename || `${safeLevelName(body.level.name)}.json`,
          name: body.level.name,
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  }
  return originalFetch(url, options);
};

try {
  input.value = 'Sheriff Office';
  await debug.saveCurrentLevel({ manual: true, saveAs: true });
  await debug.saveCurrentLevel({ manual: true });
  input.value = 'Bank Lobby';
  await debug.saveCurrentLevel({ manual: true });
} finally {
  window.fetch = originalFetch;
}

if (posts.length !== 3) throw new Error(`Expected 3 level save calls, got ${posts.length}`);
if (posts[0].filename !== null) throw new Error(`Save as should clear the current filename, got ${posts[0].filename}`);
if (posts[0].level.name !== 'Sheriff Office') throw new Error(`Save as did not use level name input: ${posts[0].level.name}`);
if (posts[1].filename !== 'Sheriff-Office.json') throw new Error(`Follow-up save did not continue in save-as file: ${posts[1].filename}`);
if (posts[2].filename !== null) throw new Error(`Renaming the file should fork to a new save, got ${posts[2].filename}`);
if (posts[2].level.name !== 'Bank Lobby') throw new Error(`Renamed save did not use new level name: ${posts[2].level.name}`);

console.log('save-as-ok');

function safeLevelName(value) {
  return (
    String(value || 'level')
      .trim()
      .replace(/\.json$/i, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'level'
  );
}
