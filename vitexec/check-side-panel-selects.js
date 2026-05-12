async function waitFor(predicate, label, timeoutMs = 5000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

await waitFor(() => window.levelMakerDebug, 'levelMakerDebug');

const select = document.querySelector('#current-style');
if (!select) throw new Error('Missing current style combo box');

select.focus();
select.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'mouse' }));
await new Promise((resolve) => setTimeout(resolve, 20));
if (document.activeElement !== select) {
  throw new Error('Side-panel combo box lost focus on pointerup and would collapse immediately');
}

select.value = select.value === 'western' ? 'default' : 'western';
select.dispatchEvent(new Event('change', { bubbles: true }));
await new Promise((resolve) => setTimeout(resolve, 20));
if (document.activeElement === select) {
  throw new Error('Side-panel combo box kept focus after change');
}

console.log('side-panel-selects-ok');
