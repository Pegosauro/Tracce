const syncDockState = () => {
  const dock = document.querySelector<HTMLElement>('.section-dock');
  const pill = dock?.querySelector<HTMLElement>('.section-pill');
  if (!dock || !pill) return;

  const activeButton = pill.querySelector<HTMLButtonElement>('button.active');
  pill.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.toggleAttribute('data-current-section', button === activeButton);
  });
};

const openDockFromCurrentButton = (event: Event) => {
  const target = event.target instanceof Element ? event.target : null;
  const currentButton = target?.closest<HTMLButtonElement>('.section-pill button.active');
  if (!currentButton) return;

  const dock = currentButton.closest<HTMLElement>('.section-dock');
  if (!dock || dock.classList.contains('is-open')) return;

  const menuButton = dock.querySelector<HTMLButtonElement>('.menu');
  if (!menuButton) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  menuButton.click();
};

const startDockBehavior = () => {
  document.addEventListener('click', openDockFromCurrentButton, true);

  const observer = new MutationObserver(syncDockState);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  syncDockState();
};

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startDockBehavior, { once: true });
  } else {
    startDockBehavior();
  }
}

export {};
