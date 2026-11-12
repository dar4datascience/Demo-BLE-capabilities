<script setup lang="ts">
import { useGameStore } from './game/store'
import PlayerView from './views/PlayerView.vue'
import AdminView from './views/AdminView.vue'

const store = useGameStore()
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand__mark" aria-hidden="true" />
        <span class="brand__name">TagTrail</span>
      </div>
      <nav class="mode-nav">
        <button
          class="mode-nav__btn"
          :class="{ 'mode-nav__btn--active': store.mode === 'player' }"
          @click="store.mode = 'player'"
        >
          Player
        </button>
        <button
          class="mode-nav__btn"
          :class="{ 'mode-nav__btn--active': store.mode === 'admin' }"
          @click="store.mode = 'admin'"
        >
          Admin
        </button>
      </nav>
    </header>
    <PlayerView v-if="store.mode === 'player'" />
    <AdminView v-else />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px 8px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand__mark {
  width: 10px;
  height: 10px;
  transform: rotate(45deg);
  border-radius: 2.5px;
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  box-shadow: 0 0 10px rgba(52, 211, 153, 0.65);
}

.brand__name {
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.02em;
  background: linear-gradient(90deg, #fff, #a7f3d0);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.mode-nav {
  display: flex;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.mode-nav__btn {
  padding: 6px 14px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--text-dim);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease;
}

.mode-nav__btn:hover {
  color: var(--text);
}

.mode-nav__btn--active {
  background: var(--accent-dim);
  border-color: var(--accent-border);
  color: var(--accent-strong);
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.18);
}
</style>
