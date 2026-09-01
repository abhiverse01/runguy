import * as THREE from 'three';
import { ORB_TOTAL } from '../config/constants.js';

function formatTime(t){
  const mins = Math.floor(t / 60), secs = Math.floor(t % 60);
  return mins + ':' + String(secs).padStart(2, '0');
}

const PX_PER_DEG = 4.6;

export class HUD {
  constructor(quests, riverPath, orbs){
    this.quests = quests;
    this.river = riverPath;
    this.orbs = orbs;

    this.hudEl = document.getElementById('hud');
    this.topControlsEl = document.getElementById('top-controls');
    this.compassWrapEl = document.getElementById('compass-wrap');
    this.questLogEl = document.getElementById('quest-log');
    this.rightStatsEl = document.getElementById('right-stats');
    this.minimapWrapEl = document.getElementById('minimap-wrap');
    this.statBarWrapEl = document.getElementById('stat-bar-wrap');
    this.abilityBarEl = document.getElementById('ability-bar');
    this.hudHintEl = document.getElementById('hud-hint');

    this.compassStrip = document.getElementById('compass-strip');
    this.questItemsEl = document.getElementById('quest-items');
    this.questCountEl = document.getElementById('quest-count');
    this.minimapCanvas = document.getElementById('minimap');
    this.mmCtx = this.minimapCanvas.getContext('2d');

    this.staminaFillEl = document.getElementById('stamina-fill');
    this.statDistanceEl = document.getElementById('stat-distance');
    this.statOrbsEl = document.getElementById('stat-orbs');
    this.statTimeEl = document.getElementById('stat-time');
    this.statFpsEl = document.getElementById('stat-fps');

    this.chipDash = document.getElementById('chip-dash');
    this.chipDJump = document.getElementById('chip-djump');
    this.chipSlam = document.getElementById('chip-slam');

    this.toastEl = document.getElementById('toast');
    this.toastQuestEl = document.getElementById('toast-quest');
    this.toastFinaleEl = document.getElementById('toast-finale');
    this.toastTimer = 0; this.questToastTimer = 0; this.finaleTimer = 0;

    this.fpsSmoothed = 60; this.fpsAccum = 0; this.fpsFrames = 0;
    this.elapsedTime = 0;

    this._buildCompass();
    this._buildQuestLog();
  }

  show(){
    this.hudEl.classList.add('visible'); this.topControlsEl.classList.add('visible');
    this.compassWrapEl.classList.add('visible'); this.questLogEl.classList.add('visible');
    this.rightStatsEl.classList.add('visible'); this.minimapWrapEl.classList.add('visible');
    this.statBarWrapEl.classList.add('visible'); this.abilityBarEl.classList.add('visible');
    setTimeout(() => { this.hudHintEl.style.opacity = '0'; }, 6000);
  }

  _buildCompass(){
    for (let deg = -360; deg <= 720; deg += 15){
      const tick = document.createElement('div');
      tick.className = 'tick' + (deg % 45 === 0 ? ' major' : '');
      tick.style.left = (deg * PX_PER_DEG) + 'px';
      this.compassStrip.appendChild(tick);
      if (deg % 90 === 0){
        const label = document.createElement('div');
        label.className = 'tick-label';
        label.style.left = (deg * PX_PER_DEG) + 'px';
        const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W', 360: 'N', 450: 'E', 540: 'S', '-90': 'W', '-180': 'N', '-270': 'E' };
        label.textContent = names[deg] ?? '';
        this.compassStrip.appendChild(label);
      }
    }
    this.questPips = this.quests.filter(q => q.marker).map(q => {
      const pip = document.createElement('div');
      pip.className = 'quest-pip';
      this.compassStrip.appendChild(pip);
      return { q, el: pip };
    });
  }

  _buildQuestLog(){
    this.quests.forEach(q => {
      const row = document.createElement('div');
      row.className = 'quest-item';
      row.id = 'quest-row-' + q.id;
      const sub = q.target
        ? `<span class="qprog" id="qprog-${q.id}">0 / ${q.target}</span>`
        : `<span class="qprog" id="qprog-${q.id}">${q.hint ?? ''}</span>`;
      row.innerHTML = `<div class="qmark">✓</div><div><div class="qname">${q.name}</div>${sub}</div>`;
      this.questItemsEl.appendChild(row);
    });
    this.refreshQuestLog();
  }

  refreshQuestLog(){
    const doneCount = this.quests.filter(q => q.done).length;
    this.questCountEl.textContent = `${doneCount}/${this.quests.length}`;
    this.quests.forEach(q => {
      const row = document.getElementById('quest-row-' + q.id);
      row.classList.toggle('done', q.done);
      const el = document.getElementById('qprog-' + q.id);
      if (el && q.target) el.textContent = `${q.progress} / ${q.target}`;
    });
  }

  updateCompass(player){
    const headingDeg = THREE.MathUtils.radToDeg(player.facing);
    this.compassStrip.style.transform = `translateX(${-headingDeg * PX_PER_DEG}px)`;
    this.questPips.forEach(({ q, el }) => {
      const bearing = THREE.MathUtils.radToDeg(Math.atan2(q.marker.x - player.x, q.marker.z - player.z));
      let rel = bearing;
      while (rel < headingDeg - 180) rel += 360;
      while (rel > headingDeg + 180) rel -= 360;
      el.style.left = (rel * PX_PER_DEG) + 'px';
      el.classList.toggle('done', q.done);
    });
  }

  drawMinimap(player){
    const s = this.minimapCanvas.width;
    const ctx = this.mmCtx;
    const MM_RANGE = 130;
    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.beginPath(); ctx.arc(s/2, s/2, s/2 - 1, 0, Math.PI*2); ctx.clip();
    ctx.fillStyle = '#233524'; ctx.fillRect(0, 0, s, s);

    const toMM = (wx, wz) => ({ x: s/2 + (wx - player.x) / MM_RANGE * (s/2), y: s/2 + (wz - player.z) / MM_RANGE * (s/2) });

    ctx.strokeStyle = 'rgba(120,180,220,0.85)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    this.river.polyline.forEach((p, i) => { const m = toMM(p.x, p.z); if (i === 0) ctx.moveTo(m.x, m.y); else ctx.lineTo(m.x, m.y); });
    ctx.stroke();

    ctx.fillStyle = 'rgba(180,140,90,0.9)';
    this.river.bridges.forEach(b => { const m = toMM(b.x, b.z); ctx.fillRect(m.x - 3, m.y - 3, 6, 6); });

    this.quests.filter(q => q.marker).forEach(q => {
      const m = toMM(q.marker.x, q.marker.z);
      ctx.beginPath(); ctx.arc(m.x, m.y, 3.4, 0, Math.PI*2);
      ctx.fillStyle = q.done ? '#9fbb8d' : '#c9814f';
      ctx.fill();
    });

    this.orbs.list.forEach(o => {
      if (o.collected) return;
      const m = toMM(o.x, o.z);
      ctx.beginPath(); ctx.arc(m.x, m.y, 2, 0, Math.PI*2);
      ctx.fillStyle = '#4fd6a8'; ctx.fill();
    });

    ctx.save();
    ctx.translate(s/2, s/2); ctx.rotate(player.facing);
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fillStyle = '#f6f2e8'; ctx.fill();
    ctx.restore();

    ctx.restore();
    ctx.strokeStyle = 'rgba(246,242,232,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(s/2, s/2, s/2 - 1, 0, Math.PI*2); ctx.stroke();
  }

  updateStats(dt, player){
    this.elapsedTime += dt;
    this.staminaFillEl.style.width = player.stamina + '%';
    this.staminaFillEl.classList.toggle('low', player.stamina < 30 && player.stamina >= 8);
    this.staminaFillEl.classList.toggle('exhausted', player.stamina < 8);
    this.statDistanceEl.innerHTML = Math.floor(player.distanceWalked) + '<span class="unit">m</span>';
    this.statOrbsEl.innerHTML = this.orbs.collectedCount + '<span class="unit">/' + ORB_TOTAL + '</span>';
    this.statTimeEl.textContent = formatTime(this.elapsedTime);

    this.chipDash.classList.toggle('cooldown', player.dashCooldownTimer > 0);
    this.chipDJump.classList.toggle('cooldown', player.jumpsUsedInAir >= 1 && !player.grounded);
    this.chipSlam.classList.toggle('cooldown', player.slamCooldownTimer > 0);

    this.fpsAccum += dt; this.fpsFrames++;
    if (this.fpsAccum >= 0.4){
      this.fpsSmoothed = this.fpsFrames / this.fpsAccum;
      this.statFpsEl.textContent = Math.round(this.fpsSmoothed);
      this.fpsAccum = 0; this.fpsFrames = 0;
    }
  }

  toast(text, sub = ''){
    this.toastEl.innerHTML = text + (sub ? `<span class="tt-sub">${sub}</span>` : '');
    this.toastEl.style.transition = 'none'; this.toastEl.style.opacity = '1';
    this.toastTimer = 2.1;
  }

  questToast(text, audio){
    this.toastQuestEl.textContent = text;
    this.toastQuestEl.style.transition = 'none'; this.toastQuestEl.style.opacity = '1';
    this.questToastTimer = 2.6;
    audio?.quest();
  }

  finale(distanceWalked, audio){
    this.toastFinaleEl.innerHTML = 'Field Fully Explored<span class="tt-sub">' +
      `${Math.floor(distanceWalked)}m walked · ${formatTime(this.elapsedTime)} elapsed</span>`;
    this.toastFinaleEl.style.transition = 'none'; this.toastFinaleEl.style.opacity = '1';
    this.finaleTimer = 4.5;
    audio?.finale();
  }

  updateToasts(dt){
    if (this.toastTimer > 0){
      this.toastTimer -= dt;
      if (this.toastTimer <= 0){ this.toastEl.style.transition = 'opacity .6s ease'; this.toastEl.style.opacity = '0'; }
    }
    if (this.questToastTimer > 0){
      this.questToastTimer -= dt;
      if (this.questToastTimer <= 0){ this.toastQuestEl.style.transition = 'opacity .6s ease'; this.toastQuestEl.style.opacity = '0'; }
    }
    if (this.finaleTimer > 0){
      this.finaleTimer -= dt;
      if (this.finaleTimer <= 0){ this.toastFinaleEl.style.transition = 'opacity .8s ease'; this.toastFinaleEl.style.opacity = '0'; }
    }
  }

  formatTime(t){ return formatTime(t); }
}
