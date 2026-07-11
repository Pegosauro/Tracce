type ActiveSheetGesture = {
  pointerId: number;
  handle: HTMLElement;
  sheet: HTMLElement;
  closeControl: HTMLElement;
  startY: number;
  lastY: number;
  lastTime: number;
  distance: number;
  velocity: number;
};

declare global {
  interface Window {
    __tracceSheetGesturesInstalled?: boolean;
  }
}

const CLOSE_DISTANCE = 72;
const FLICK_DISTANCE = 28;
const FLICK_VELOCITY = 0.45;
const ANIMATION_MS = 180;

const buttonText = (element: HTMLElement) => element.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? '';

const findCloseControl = (sheet: HTMLElement) => {
  const explicit = sheet.querySelector<HTMLElement>('[data-sheet-close], button[aria-label="Chiudi"]');
  if (explicit) return explicit;

  const actions = Array.from(sheet.querySelectorAll<HTMLElement>('.sheet-actions button'));
  if (sheet.classList.contains('filter-sheet')) {
    return actions.find((button) => buttonText(button) === 'applica') ?? null;
  }

  return actions.find((button) => buttonText(button) === 'annulla') ?? null;
};

const prepareHandle = (handle: HTMLElement) => {
  handle.setAttribute('role', 'button');
  handle.setAttribute('aria-label', 'Trascina verso il basso per chiudere');
  handle.tabIndex = 0;
};

const prepareHandles = (root: ParentNode = document) => {
  root.querySelectorAll<HTMLElement>('.bottom-sheet .grabber').forEach(prepareHandle);
};

const installSheetGestures = () => {
  let activeGesture: ActiveSheetGesture | null = null;

  prepareHandles();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches('.bottom-sheet .grabber')) prepareHandle(node);
        prepareHandles(node);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('pointerdown', (event) => {
    if (activeGesture || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (!(event.target instanceof Element)) return;

    const handle = event.target.closest<HTMLElement>('.bottom-sheet .grabber');
    const sheet = handle?.closest<HTMLElement>('.bottom-sheet');
    if (!handle || !sheet) return;

    const closeControl = findCloseControl(sheet);
    if (!closeControl) return;

    const timestamp = performance.now();
    activeGesture = {
      pointerId: event.pointerId,
      handle,
      sheet,
      closeControl,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: timestamp,
      distance: 0,
      velocity: 0,
    };

    handle.setPointerCapture(event.pointerId);
    sheet.classList.remove('sheet-is-resetting', 'sheet-is-closing');
    sheet.classList.add('sheet-is-dragging');
    sheet.style.setProperty('--sheet-drag-y', '0px');
    event.preventDefault();
  }, { passive: false });

  document.addEventListener('pointermove', (event) => {
    const gesture = activeGesture;
    if (!gesture || event.pointerId !== gesture.pointerId) return;

    const now = performance.now();
    const elapsed = Math.max(1, now - gesture.lastTime);
    const movement = event.clientY - gesture.lastY;
    const distance = Math.max(0, event.clientY - gesture.startY);

    gesture.velocity = movement > 0 ? movement / elapsed : 0;
    gesture.distance = distance;
    gesture.lastY = event.clientY;
    gesture.lastTime = now;
    gesture.sheet.style.setProperty('--sheet-drag-y', `${distance}px`);
    event.preventDefault();
  }, { passive: false });

  const finishGesture = (event: PointerEvent, cancelled: boolean) => {
    const gesture = activeGesture;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    activeGesture = null;

    if (gesture.handle.hasPointerCapture(event.pointerId)) {
      gesture.handle.releasePointerCapture(event.pointerId);
    }

    const shouldClose = !cancelled && (
      gesture.distance >= CLOSE_DISTANCE
      || (gesture.distance >= FLICK_DISTANCE && gesture.velocity >= FLICK_VELOCITY)
    );

    gesture.sheet.classList.remove('sheet-is-dragging');

    if (shouldClose) {
      gesture.sheet.classList.add('sheet-is-closing');
      const exitDistance = Math.max(window.innerHeight, gesture.sheet.offsetHeight + 64);
      gesture.sheet.style.setProperty('--sheet-drag-y', `${exitDistance}px`);
      window.setTimeout(() => gesture.closeControl.click(), ANIMATION_MS);
      return;
    }

    gesture.sheet.classList.add('sheet-is-resetting');
    gesture.sheet.style.setProperty('--sheet-drag-y', '0px');
    window.setTimeout(() => gesture.sheet.classList.remove('sheet-is-resetting'), ANIMATION_MS);
  };

  document.addEventListener('pointerup', (event) => finishGesture(event, false));
  document.addEventListener('pointercancel', (event) => finishGesture(event, true));

  document.addEventListener('keydown', (event) => {
    if (!(event.target instanceof Element)) return;
    const handle = event.target.closest<HTMLElement>('.bottom-sheet .grabber');
    const sheet = handle?.closest<HTMLElement>('.bottom-sheet');
    if (!handle || !sheet || !['Enter', ' ', 'Escape'].includes(event.key)) return;

    const closeControl = findCloseControl(sheet);
    if (!closeControl) return;

    event.preventDefault();
    closeControl.click();
  });
};

if (!window.__tracceSheetGesturesInstalled) {
  window.__tracceSheetGesturesInstalled = true;
  installSheetGestures();
}

export {};
