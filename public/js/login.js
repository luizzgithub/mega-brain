import { STATE } from './state.js';
import { bindAuthEvents, getReturnTo } from './auth.js';

function boot() {
  if (STATE.token) {
    window.location.replace(getReturnTo());
    return;
  }
  bindAuthEvents();
}

window.addEventListener('DOMContentLoaded', boot);
