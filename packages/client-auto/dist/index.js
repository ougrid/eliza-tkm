// src/index.ts
var AutoClient = class {
  interval;
  runtime;
  constructor(runtime) {
    this.runtime = runtime;
    this.interval = setInterval(
      async () => {
        console.log("running auto client...");
      },
      60 * 60 * 1e3
    );
  }
};
var AutoClientInterface = {
  start: async (runtime) => {
    const client = new AutoClient(runtime);
    return client;
  },
  stop: async (_runtime) => {
    console.warn("Direct client does not support stopping yet");
  }
};
var src_default = AutoClientInterface;
export {
  AutoClient,
  AutoClientInterface,
  src_default as default
};
//# sourceMappingURL=index.js.map