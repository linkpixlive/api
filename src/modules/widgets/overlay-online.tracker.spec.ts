import { OverlayOnlineTracker } from './overlay-online.tracker';

describe('OverlayOnlineTracker', () => {
  const WINDOW_MS = 80_000;
  let tracker: OverlayOnlineTracker;
  let now: number;
  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    tracker = new OverlayOnlineTracker();
    now = 1_000_000;
    nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('overlay com pulso recente está on-line', () => {
    tracker.mark('tok');
    expect(tracker.isFresh('tok')).toBe(true);
  });

  it('expira após a janela de 80s', () => {
    tracker.mark('tok');
    now += WINDOW_MS;
    expect(tracker.isFresh('tok')).toBe(true);
    now += 1;
    expect(tracker.isFresh('tok')).toBe(false);
  });

  it('purge (desconexão) força offline', () => {
    tracker.mark('tok');
    tracker.purge('tok');
    expect(tracker.isFresh('tok')).toBe(false);
  });
});
