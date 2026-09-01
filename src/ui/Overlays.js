import { QUALITY_STATE } from '../config/constants.js';

export class Overlays {
  constructor({ renderer, scene, input, audio, hud, onStart, onQualityChange }){
    this.renderer = renderer;
    this.scene = scene;
    this.input = input;
    this.audio = audio;
    this.hud = hud;
    this.onStart = onStart;
    this.onQualityChange = onQualityChange;

    this.state = 'loading'; // loading -> ready -> playing -> paused

    this.loadingOverlay = document.getElementById('loading-overlay');
    this.startOverlay = document.getElementById('start-overlay');
    this.pauseOverlay = document.getElementById('pause-overlay');
    this.devModal = document.getElementById('dev-modal');

    this._bindQualityChips();
    this._bindButtons();
  }

  _bindQualityChips(){
    document.querySelectorAll('.quality-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        QUALITY_STATE.current = chip.dataset.q;
        document.querySelectorAll('.quality-chip').forEach(c => c.classList.toggle('active', c === chip));
        this.onQualityChange?.(QUALITY_STATE.current);
      });
    });
  }

  _bindButtons(){
    document.getElementById('btn-start').addEventListener('click', () => {
      this.audio.ensure();
      this.startOverlay.classList.add('hidden');
      this.hud.show();
      this.state = 'playing';
      this.onStart?.();
    });

    document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-resume').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-restart').addEventListener('click', () => window.location.reload());

    const muteBtn = document.getElementById('btn-mute');
    muteBtn.addEventListener('click', (e) => {
      const muted = this.audio.toggleMute();
      e.currentTarget.classList.toggle('on', muted);
      e.currentTarget.textContent = muted ? '𝄽' : '♪';
    });

    const btnLock = document.getElementById('btn-lock');
    if (btnLock){
      if (this.input.canvas && !('ontouchstart' in window)){
        btnLock.addEventListener('click', () => this.input.requestPointerLock());
        document.addEventListener('pointerlockchange', () => {
          btnLock.classList.toggle('on', this.input.pointerLocked);
        });
      } else {
        btnLock.style.display = 'none';
      }
    }

    const openDevModal = () => this.devModal.classList.remove('hidden');
    document.getElementById('btn-help').addEventListener('click', openDevModal);
    document.getElementById('credit-dev-btn').addEventListener('click', openDevModal);
    document.getElementById('dev-close').addEventListener('click', () => this.devModal.classList.add('hidden'));
    this.devModal.addEventListener('click', (e) => { if (e.target === this.devModal) this.devModal.classList.add('hidden'); });

    this.input.on('pause', () => this.togglePause());
  }

  togglePause(){
    if (this.state === 'playing'){
      this.state = 'paused';
      if (document.pointerLockElement) document.exitPointerLock();
      this.onPauseSummaryRequest?.();
      this.pauseOverlay.classList.remove('hidden');
    } else if (this.state === 'paused'){
      this.state = 'playing';
      this.pauseOverlay.classList.add('hidden');
    }
  }

  fillPauseSummary({ quests, questTotal, orbs, orbTotal, distance, time }){
    document.getElementById('pause-quests').textContent = `${quests}/${questTotal}`;
    document.getElementById('pause-orbs').textContent = `${orbs}/${orbTotal}`;
    document.getElementById('pause-dist').textContent = `${Math.floor(distance)}m`;
    document.getElementById('pause-time').textContent = time;
  }

  runBootSequence(onComplete){
    const loadBar = document.getElementById('load-bar');
    const loadLabel = document.getElementById('load-label');
    const steps = ['preparing terrain', 'carving the river', 'raising the bridges', 'planting the field', 'ready'];
    let stepI = 0;
    const timer = setInterval(() => {
      stepI++;
      loadBar.style.width = Math.min(100, stepI / steps.length * 100) + '%';
      loadLabel.textContent = steps[Math.min(stepI, steps.length - 1)];
      if (stepI >= steps.length){
        clearInterval(timer);
        setTimeout(() => {
          this.loadingOverlay.classList.add('hidden');
          this.startOverlay.classList.remove('hidden');
          this.state = 'ready';
          onComplete?.();
        }, 250);
      }
    }, 220);
  }
}
