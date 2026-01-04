require("dotenv").config();
const { httpServer } = require('./app');

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  httpServer.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  httpServer.close(() => process.exit(0));
});
