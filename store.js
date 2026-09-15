const KEY = "glitch-park-claw";

function canUseLocalStorage() {
  try {
    localStorage.setItem(`${KEY}:probe`, "1");
    localStorage.removeItem(`${KEY}:probe`);
    return true;
  } catch (_) {
    return false;
  }
}

export const Store = {
  local: canUseLocalStorage(),
  data: { owned: [], plays: 0, wins: 0 },

  async load() {
    if (this.local) {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) this.data = { ...this.data, ...JSON.parse(raw) };
      } catch (_) { /* 壞掉的舊資料直接忽略。 */ }
      return this.data;
    }
    return new Promise(resolve => {
      const done = state => {
        if (state) this.data = { ...this.data, ...state };
        resolve(this.data);
      };
      const timer = setTimeout(() => {
        removeEventListener("message", onMessage);
        done();
      }, 1200);
      const onMessage = event => {
        if (event.data?.type !== "claw:state") return;
        clearTimeout(timer);
        removeEventListener("message", onMessage);
        done(event.data.state);
      };
      addEventListener("message", onMessage);
      parent.postMessage({ type: "claw:ready" }, "*");
    });
  },

  save() {
    if (this.local) {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (_) { /* 儲存空間不足不影響遊戲。 */ }
    } else {
      parent.postMessage({ type: "claw:save", state: this.data }, "*");
    }
  },

  finish(id = null) {
    this.data.plays++;
    if (id) {
      this.data.wins++;
      if (!this.data.owned.includes(id)) this.data.owned.push(id);
    }
    this.save();
  },
};

