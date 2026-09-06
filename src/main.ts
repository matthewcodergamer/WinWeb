import './styles.css';
import { probeRuntimeCapabilities } from './core/capabilities';
import { WinWebApp } from './ui/app';

async function boot() {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app root');
  root.innerHTML = '<div class="boot"><span class="window-mark hero-mark"><i></i><i></i><i></i><i></i><b></b></span><strong>WinWeb</strong><small>Preparing Windows runtime…</small></div>';
  const capabilities = await probeRuntimeCapabilities();
  new WinWebApp(root, capabilities).mount();
}

void boot();
