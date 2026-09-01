import { HILL_CENTER, KNOLL_CENTER, ORB_TOTAL } from '../config/constants.js';

export function buildQuestDefinitions(riverPath){
  return [
    { id: 'q1', name: 'First Crossing', done: false, marker: { x: riverPath.bridges[0].x, z: riverPath.bridges[0].z }, hint: 'Find the nearest bridge.' },
    { id: 'q2', name: 'Triple Crossing', done: false, needsAll: [0,1,2], visited: new Set(), hint: 'Cross all three bridges.' },
    { id: 'q3', name: 'Hilltop Beacon', done: false, marker: { x: HILL_CENTER.x, z: HILL_CENTER.z }, hint: 'Climb the tall hill.' },
    { id: 'q4', name: 'Rocky Outcrop', done: false, marker: { x: KNOLL_CENTER.x, z: KNOLL_CENTER.z }, hint: 'Reach the rocky knoll.' },
    { id: 'q5', name: "River's End", done: false, marker: { x: 155, z: 150 }, hint: 'Follow the river to its end.' },
    { id: 'q6', name: 'Orb Collector', done: false, progress: 0, target: ORB_TOTAL, hint: 'Collect the glowing orbs.' },
  ];
}

export class QuestSystem {
  constructor(riverPath){
    this.river = riverPath;
    this.quests = buildQuestDefinitions(riverPath);
    this.onQuestComplete = null; // (quest) => void
    this.onFinale = null;        // () => void
    this.finaleShown = false;
  }

  registerOrbProgress(count){
    if (count <= 0) return null;
    const q = this.quests.find(q => q.id === 'q6');
    q.progress += count;
    if (q.progress >= q.target && !q.done){
      q.done = true;
      this._complete(q);
    }
    return q;
  }

  update(player){
    this.quests.forEach(q => {
      if (q.done || !q.marker) return;
      const d = Math.hypot(player.x - q.marker.x, player.z - q.marker.z);
      if (d < 3.2){
        q.done = true;
        this._complete(q);
      }
    });

    const q2 = this.quests.find(q => q.id === 'q2');
    if (!q2.done){
      this.river.bridges.forEach((b, i) => {
        const d = Math.hypot(player.x - b.x, player.z - b.z);
        if (d < 3.2) q2.visited.add(i);
      });
      if (q2.visited.size >= 3){
        q2.done = true;
        this._complete(q2);
      }
    }

    if (!this.finaleShown && this.quests.every(q => q.done)){
      this.finaleShown = true;
      this.onFinale?.();
    }
  }

  _complete(quest){ this.onQuestComplete?.(quest); }

  get doneCount(){ return this.quests.filter(q => q.done).length; }
}
