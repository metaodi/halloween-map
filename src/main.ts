import './style.css';
import { defaultVillage, findVillage } from './config/villages';
import { renderAdminPage } from './pages/AdminPage';
import { renderMapPage } from './pages/MapPage';
import { renderVillageSelectPage } from './pages/VillageSelectPage';

const root = document.getElementById('app')!;
const params = new URLSearchParams(window.location.search);

if (params.has('admin')) {
  void renderAdminPage(root);
} else {
  // ?gemeinden erzwingt die Gemeindeauswahl, auch wenn eine Standard-Gemeinde konfiguriert ist
  const village = params.has('gemeinden') ? undefined : (findVillage(params.get('ort')) ?? defaultVillage());
  if (village) {
    document.title = `HalloweenMap ${village.name}`;
    renderMapPage(root, village, params.get('loeschen'));
  } else {
    renderVillageSelectPage(root);
  }
}
