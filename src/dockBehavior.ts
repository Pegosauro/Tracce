const syncDockState = () => {
  const dock = document.querySelector<HTMLElement>('.section-dock');
  const pill = dock?.querySelector<HTMLElement>('.section-pill');
  const menuButton = dock?.querySelector<HTMLButtonElement>('.menu');
  if (!dock || !pill || !menuButton) return;

  const activeButton = pill.querySelector<HTMLButtonElement>('button.active');
  pill.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.toggleAttribute('data-current-section', button === activeButton);
  });

  if (!activeButton) return;

  const nextIcon = activeButton.innerHTML;
  if (menuButton.dataset.sectionIcon !== nextIcon) {
    menuButton.dataset.sectionIcon = nextIcon;
    menuButton.innerHTML = nextIcon;
  }

  const activeLabel = activeButton.textContent?.trim() || 'Menu sezioni';
  menuButton.setAttribute('aria-label', `Apri menu sezioni. Sezione attiva: ${activeLabel}`);
};

const startDockBehavior = () => {
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
