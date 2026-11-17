import { useEffect, useState } from 'react';
import { liveAvailable } from '../live';
import { exportSave, importSave, resetGame, updateSettings, useMeta, useSettings } from '../store';

export function SettingsButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="icon-btn" aria-label="Settings" onClick={onOpen}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    </button>
  );
}

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const meta = useMeta();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let alive = true;
    liveAvailable(settings.apiKey).then((ok) => alive && setAvailable(ok));
    return () => {
      alive = false;
    };
  }, [settings.apiKey]);

  const fullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (el.requestFullscreen) void el.requestFullscreen().catch(() => setMessage('Full screen is not available here. On iPhone, use Share › Add to Home Screen.'));
    else setMessage('Full screen is not available here. On iPhone, use Share › Add to Home Screen.');
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="console settings">
        <div className="console-head">
          <span>Settings</span>
          <button type="button" className="btn btn-plain" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="settings-body">
          <section>
            <h2 className="label">Live characters</h2>
            <p className="small dim">
              Dana, Edgar and Ferry can be played by a language model, so you can type to them. Without it they use written dialogue, which is the whole game. Outcomes are the same either way.
            </p>
            <label className="check">
              <input type="checkbox" checked={settings.live} onChange={(e) => updateSettings({ live: e.target.checked })} /> Use live characters when available
            </label>
            <label htmlFor="key" className="label">
              Your own Anthropic API key (optional, stays in this browser)
            </label>
            <input id="key" type="password" autoComplete="off" value={settings.apiKey} onChange={(e) => updateSettings({ apiKey: e.target.value.trim() })} placeholder="sk-ant-…" />
            <p className="small">{available === null ? 'Checking…' : available ? <span className="teal">Live characters are available.</span> : <span className="dim">Not available right now. The written dialogue will be used.</span>}</p>
          </section>
          <section>
            <h2 className="label">Screen</h2>
            <button type="button" className="btn btn-plain" onClick={fullscreen}>
              Toggle full screen
            </button>
            <p className="small dim">On iPhone, full screen comes from Share › Add to Home Screen.</p>
          </section>
          <section>
            <h2 className="label">Save</h2>
            <div className="row">
              <button
                type="button"
                className="btn btn-plain"
                onClick={() => {
                  const c = exportSave();
                  setCode(c);
                  void navigator.clipboard?.writeText(c).then(() => setMessage('Save copied to the clipboard.'), () => setMessage('Copy the code below.'));
                }}
              >
                Export
              </button>
              <button type="button" className="btn btn-plain" onClick={() => setMessage(importSave(code) ? 'Save imported.' : 'That code did not work.')}>
                Import
              </button>
            </div>
            <label htmlFor="code" className="label">
              Save code
            </label>
            <textarea id="code" rows={2} value={code} onChange={(e) => setCode(e.target.value)} />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (confirm('Start over from the dark? This run will be lost.')) {
                  resetGame();
                  onClose();
                }
              }}
            >
              Start over
            </button>
            <p className="small dim">
              Runs started: {meta.runs} · endings found: {meta.endings.length} of 3
            </p>
          </section>
          {message && (
            <p className="small amber" role="status">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** iPhone has no Fullscreen API for pages; the home-screen install is the way. */
export function InstallHint() {
  const settings = useSettings();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const ios = /iphone|ipod/i.test(navigator.userAgent);
    const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || (navigator as { standalone?: boolean }).standalone === true;
    setShow(ios && !standalone && !settings.installHintSeen);
  }, [settings.installHintSeen]);
  if (!show) return null;
  return (
    <div className="toast reveal" role="status">
      <div className="small">For full screen: Share › Add to Home Screen. It plays the same, without the browser around it.</div>
      <button type="button" className="btn btn-plain" onClick={() => updateSettings({ installHintSeen: true })}>
        OK
      </button>
    </div>
  );
}
