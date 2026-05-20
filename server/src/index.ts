import { config } from "./config.js";
import { createApp } from "./app.js";

const app = await createApp();

app.listen(config.port, "127.0.0.1", () => {
  console.log(`Server running on http://127.0.0.1:${config.port}`);
});

