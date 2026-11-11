<script setup lang="ts">
import { useGameStore } from './game/store'
import PlayerView from './views/PlayerView.vue'
import AdminView from './views/AdminView.vue'

const store = useGameStore()
</script>

<template>
  <div class="app-shell">
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

.mode-nav {
  display: flex;
  gap: 4px;
  padding: 8px 12px 0;
}

.mode-nav__btn {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 10px 10px 0 0;
  background: rgba(127, 127, 127, 0.12);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.mode-nav__btn--active {
  background: #2563eb;
  color: #fff;
}
</style>
