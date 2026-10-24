import './style.css';
import { defaultVillage, findVillage } from './config/villages';
import { renderMapPage } from './pages/MapPage';
import { renderVillageSelectPage } from './pages/VillageSelectPage';

const root = document.getElementById('app')!;
const params = new URLSearchParams(window.location.search);

const village = findVillage(params.get('ort')) ?? defaultVillage();
if (village) {
  document.title = `HalloweenMap ${village.name}`;
  renderMapPage(root, village, params.get('loeschen'));
} else {
  renderVillageSelectPage(root);
}
